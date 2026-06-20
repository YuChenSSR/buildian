import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { computeSystemPromptKey } from '../../../core/prompt/mainAgent';
import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import { ProviderSettingsCoordinator } from '../../../core/providers/ProviderSettingsCoordinator';
import type { ProviderCapabilities } from '../../../core/providers/types';
import type { ChatRuntime } from '../../../core/runtime/ChatRuntime';
import type {
  ApprovalCallback,
  ApprovalDecisionOption,
  AskUserQuestionCallback,
  AutoTurnCallback,
  ChatRewindMode,
  ChatRewindResult,
  ChatRuntimeEnsureReadyOptions,
  ChatRuntimeQueryOptions,
  ChatTurnMetadata,
  ChatTurnRequest,
  PreparedChatTurn,
  SessionUpdateResult,
  SubagentRuntimeState,
} from '../../../core/runtime/types';
import type {
  ApprovalDecision,
  ChatMessage,
  Conversation,
  ExitPlanModeCallback,
  SlashCommand,
  StreamChunk,
  ToolCallInfo,
} from '../../../core/types';
import type ClaudianPlugin from '../../../main';
import { getEnhancedPath, parseEnvironmentVariables } from '../../../utils/env';
import { getVaultPath } from '../../../utils/path';
import {
  type AcpAvailableCommand,
  AcpClientConnection,
  type AcpInitializeResponse,
  AcpJsonRpcTransport,
  type AcpReadTextFileRequest,
  type AcpRequestPermissionRequest,
  type AcpRequestPermissionResponse,
  type AcpSessionConfigOption,
  type AcpSessionModeState,
  type AcpSessionNotification,
  AcpSessionUpdateNormalizer,
  AcpSubprocess,
  type AcpUsage,
  type AcpUsageUpdate,
  type AcpWriteTextFileRequest,
  buildAcpUsageInfo,
  extractAcpSessionModeState,
  flattenAcpSessionConfigSelectOptions,
} from '../../acp';
import { AMP_PROVIDER_CAPABILITIES } from '../capabilities';
import {
  AMP_MODEL_ID,
  AMP_PROVIDER_ID,
  type AmpAgentMode,
  ampModeSupportsEffort,
  isAmpModelSelectionId,
  normalizeAmpEffort,
  normalizeAmpModelId,
  resolveAmpAgentMode,
} from '../models';
import { getAmpProviderSettings } from '../settings';
import type { AmpProviderState } from '../types';
import { getAmpState } from '../types';
import { buildAmpAcpAdapterArgs } from './AmpCliResolver';
import { buildAmpPromptBlocks, buildAmpPromptText } from './buildAmpPrompt';

interface ActiveTurn {
  queue: StreamChunkQueue;
  sessionId: string;
}

interface AmpLaunchSpec {
  args: string[];
  command: string;
  cwd: string;
  env: NodeJS.ProcessEnv;
  launchKey: string;
  sessionConfigKey: string;
}

class StreamChunkQueue {
  private closed = false;
  private readonly items: StreamChunk[] = [];
  private readonly waiters: Array<(chunk: StreamChunk | null) => void> = [];

  push(chunk: StreamChunk): void {
    if (this.closed) {
      return;
    }

    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(chunk);
      return;
    }
    this.items.push(chunk);
  }

  close(): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    while (this.waiters.length > 0) {
      this.waiters.shift()?.(null);
    }
  }

  async next(): Promise<StreamChunk | null> {
    if (this.items.length > 0) {
      return this.items.shift() ?? null;
    }

    if (this.closed) {
      return null;
    }

    return new Promise<StreamChunk | null>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}

export class AmpChatRuntime implements ChatRuntime {
  readonly providerId = AMP_PROVIDER_ID;

  private activeTurn: ActiveTurn | null = null;
  private agentVersion: string | null = null;
  private approvalCallback: ApprovalCallback | null = null;
  private connection: AcpClientConnection | null = null;
  private contextUsage: AcpUsageUpdate | null = null;
  private currentLaunchKey: string | null = null;
  private currentTurnMetadata: ChatTurnMetadata = {};
  private loadedSessionId: string | null = null;
  private process: AcpSubprocess | null = null;
  private promptUsage: AcpUsage | null = null;
  private ready = false;
  private readonly readyListeners = new Set<(ready: boolean) => void>();
  private currentSessionConfigKey: string | null = null;
  private sessionId: string | null = null;
  private sessionInvalidated = false;
  private readonly sessionCwds = new Map<string, string>();
  private readonly sessionUpdateNormalizer = new AcpSessionUpdateNormalizer();
  private readonly supportedCommandWaiters: Array<(commands: SlashCommand[]) => void> = [];
  private supportedCommands: SlashCommand[] = [];
  private transport: AcpJsonRpcTransport | null = null;
  private unregisterTransportClose: (() => void) | null = null;

  constructor(private readonly plugin: ClaudianPlugin) {}

  getCapabilities(): Readonly<ProviderCapabilities> {
    return AMP_PROVIDER_CAPABILITIES;
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    return {
      isCompact: false,
      mcpMentions: request.enabledMcpServers ?? new Set(),
      persistedContent: '',
      prompt: buildAmpPromptText(request, [], this.getAmpSystemPrompt()),
      request,
    };
  }

  onReadyStateChange(listener: (ready: boolean) => void): () => void {
    this.readyListeners.add(listener);
    return () => {
      this.readyListeners.delete(listener);
    };
  }

  setResumeCheckpoint(_checkpointId: string | undefined): void {}

  syncConversationState(
    conversation: { providerState?: Record<string, unknown>; sessionId?: string | null } | null,
  ): void {
    if (!conversation) {
      this.sessionId = null;
      this.loadedSessionId = null;
      this.sessionInvalidated = false;
      this.agentVersion = null;
      this.currentSessionConfigKey = null;
      this.setSupportedCommands([]);
      return;
    }

    const nextSessionId = conversation.sessionId ?? null;
    if (this.sessionId !== nextSessionId) {
      this.loadedSessionId = null;
      this.sessionInvalidated = false;
      this.setSupportedCommands([]);
    }
    this.sessionId = nextSessionId;
    const state = getAmpState(conversation.providerState);
    this.agentVersion = state.agentVersion ?? this.agentVersion;
    this.currentSessionConfigKey = state.sessionConfigKey ?? null;
  }

  async reloadMcpServers(): Promise<void> {}

  async ensureReady(options?: ChatRuntimeEnsureReadyOptions): Promise<boolean> {
    const settings = getAmpProviderSettings(this.plugin.settings);
    if (!settings.enabled) {
      this.setReady(false);
      return false;
    }

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    const resolvedCliPath = this.plugin.getResolvedProviderCliPath(AMP_PROVIDER_ID) ?? 'acp-amp';
    const providerSettings = this.getProviderSettings();
    const envText = getRuntimeEnvironmentText(
      this.plugin.settings,
      AMP_PROVIDER_ID,
    );
    const requestMeta = this.resolveAmpRequestMeta(providerSettings);
    const launchSpec = this.buildLaunchSpec({
      agentMode: requestMeta.mode,
      command: resolvedCliPath,
      cwd,
      effort: requestMeta.effort ?? '',
      envText,
      permissionMode: this.resolvePermissionMode(providerSettings),
      systemPromptKey: this.getAmpSystemPromptKey(),
    });
    const sessionConfigChanged = Boolean(this.sessionId)
      && this.currentSessionConfigKey !== launchSpec.sessionConfigKey;
    if (sessionConfigChanged) {
      this.sessionInvalidated = true;
      this.clearActiveSession();
    }

    const shouldRestart = !this.process
      || !this.transport
      || !this.connection
      || !this.process.isAlive()
      || this.transport.isClosed
      || options?.force === true
      || this.currentLaunchKey !== launchSpec.launchKey;

    if (shouldRestart) {
      await this.shutdownProcess();
      await this.startProcess(launchSpec);
      this.currentLaunchKey = launchSpec.launchKey;
      this.currentSessionConfigKey = launchSpec.sessionConfigKey;
      this.loadedSessionId = null;
    }

    const targetSessionId = this.sessionId;
    if (targetSessionId) {
      if (this.loadedSessionId !== targetSessionId) {
        const loaded = await this.loadSession(targetSessionId, cwd);
        if (!loaded) {
          this.sessionInvalidated = true;
          this.clearActiveSession();
        }
      }
      return true;
    }

    if (!this.sessionId && !this.sessionInvalidated) {
      if (options?.allowSessionCreation === false) {
        return true;
      }
      return Boolean(await this.createSession(cwd));
    }

    return true;
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    _queryOptions?: ChatRuntimeQueryOptions,
  ): AsyncGenerator<StreamChunk> {
    const previousMessages = conversationHistory ?? [];
    const expectedSessionId = this.sessionId;
    let shouldBootstrapHistory = previousMessages.length > 0
      && (!expectedSessionId || this.sessionInvalidated);

    if (!(await this.ensureReady())) {
      yield { type: 'error', content: 'Failed to start Amp. Check the CLI path and login state.' };
      yield { type: 'done' };
      return;
    }

    if (!this.connection) {
      yield { type: 'error', content: 'Amp runtime is not ready.' };
      yield { type: 'done' };
      return;
    }

    const cwd = getVaultPath(this.plugin.app) ?? process.cwd();
    if (expectedSessionId && !this.sessionId) {
      shouldBootstrapHistory = previousMessages.length > 0;
    }

    if (!this.sessionId) {
      const sessionId = await this.createSession(cwd);
      if (!sessionId) {
        yield { type: 'error', content: 'Failed to create an Amp session.' };
        yield { type: 'done' };
        return;
      }
    }

    const sessionId = this.sessionId!;
    this.activeTurn?.queue.close();
    this.activeTurn = {
      queue: new StreamChunkQueue(),
      sessionId,
    };
    this.currentTurnMetadata = {};
    this.contextUsage = null;
    this.promptUsage = null;
    this.sessionUpdateNormalizer.reset();

    const activeTurn = this.activeTurn;
    const requestMeta = this.resolveAmpRequestMeta(this.getProviderSettings());
    const promptPromise = this.connection.prompt({
      _meta: { 'acp-amp': requestMeta },
      prompt: buildAmpPromptBlocks(
        turn.request,
        shouldBootstrapHistory ? previousMessages : [],
        this.getAmpSystemPrompt(),
      ),
      sessionId,
    }).then((response) => {
      if (response.userMessageId) {
        this.currentTurnMetadata.userMessageId = response.userMessageId;
      }
      this.promptUsage = response.usage ?? null;

      const usage = buildAcpUsageInfo({
        contextWindow: this.contextUsage,
        model: this.getActiveDisplayModel(),
        promptUsage: this.promptUsage,
      });
      if (usage) {
        activeTurn.queue.push({ sessionId, type: 'usage', usage });
      }

      activeTurn.queue.push({ type: 'done' });
      activeTurn.queue.close();
    }).catch((error) => {
      activeTurn.queue.push({
        type: 'error',
        content: this.formatRuntimeError(error),
      });
      activeTurn.queue.push({ type: 'done' });
      activeTurn.queue.close();
    }).finally(() => {
      if (this.activeTurn === activeTurn) {
        this.activeTurn = null;
      }
    });

    try {
      while (true) {
        const chunk = await activeTurn.queue.next();
        if (!chunk) {
          break;
        }
        yield chunk;
      }
      await promptPromise;
    } finally {
      if (this.activeTurn === activeTurn) {
        this.activeTurn = null;
      }
    }
  }

  cancel(): void {
    if (this.connection && this.sessionId) {
      this.connection.cancel({ sessionId: this.sessionId });
    }
  }

  resetSession(): void {
    this.clearActiveSession();
    this.sessionInvalidated = false;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  consumeSessionInvalidation(): boolean {
    const invalidated = this.sessionInvalidated;
    this.sessionInvalidated = false;
    return invalidated;
  }

  isReady(): boolean {
    return this.ready;
  }

  async getSupportedCommands(): Promise<SlashCommand[]> {
    if (this.supportedCommands.length > 0) {
      return [...this.supportedCommands];
    }

    if (!this.connection) {
      return [];
    }

    return this.waitForSupportedCommands();
  }

  getAuxiliaryModel(): string | null {
    return this.getActiveDisplayModel() ?? null;
  }

  cleanup(): void {
    this.activeTurn?.queue.close();
    void this.shutdownProcess();
  }

  async rewind(
    _userMessageId: string,
    _assistantMessageId: string,
    _mode?: ChatRewindMode,
  ): Promise<ChatRewindResult> {
    return { canRewind: false };
  }

  setApprovalCallback(callback: ApprovalCallback | null): void {
    this.approvalCallback = callback;
  }

  setApprovalDismisser(_dismisser: (() => void) | null): void {}
  setAskUserQuestionCallback(_callback: AskUserQuestionCallback | null): void {}
  setExitPlanModeCallback(_callback: ExitPlanModeCallback | null): void {}
  setPermissionModeSyncCallback(_callback: ((sdkMode: string) => void) | null): void {}
  setSubagentHookProvider(_getState: () => SubagentRuntimeState): void {}
  setAutoTurnCallback(_callback: AutoTurnCallback | null): void {}

  consumeTurnMetadata(): ChatTurnMetadata {
    const metadata = this.currentTurnMetadata;
    this.currentTurnMetadata = {};
    return metadata;
  }

  buildSessionUpdates(params: {
    conversation: Conversation | null;
    sessionInvalidated: boolean;
  }): SessionUpdateResult {
    const existingState = params.conversation
      ? getAmpState(params.conversation.providerState)
      : null;
    const providerState: AmpProviderState = {
      ...(this.agentVersion || existingState?.agentVersion
        ? { agentVersion: this.agentVersion ?? existingState?.agentVersion }
        : {}),
      ...(this.currentSessionConfigKey
        ? { sessionConfigKey: this.currentSessionConfigKey }
        : {}),
    };
    const updates: Partial<Conversation> = {
      providerState: Object.keys(providerState).length > 0
        ? providerState as Record<string, unknown>
        : undefined,
      sessionId: this.sessionId,
    };

    if (params.sessionInvalidated && !this.sessionId) {
      updates.providerState = undefined;
      updates.sessionId = null;
    }

    return { updates };
  }

  resolveSessionIdForFork(conversation: Conversation | null): string | null {
    return this.sessionId ?? conversation?.sessionId ?? null;
  }

  async loadSubagentToolCalls(_agentId: string): Promise<ToolCallInfo[]> {
    return [];
  }

  async loadSubagentFinalResult(_agentId: string): Promise<string | null> {
    return null;
  }

  private buildLaunchSpec(params: {
    agentMode: string;
    command: string;
    cwd: string;
    effort: string;
    envText: string;
    permissionMode: string;
    systemPromptKey: string;
  }): AmpLaunchSpec {
    const args = buildAmpAcpAdapterArgs(params.command);
    const customEnv = parseEnvironmentVariables(params.envText);
    const env = {
      ...process.env,
      ...customEnv,
      PATH: getEnhancedPath(customEnv.PATH, path.isAbsolute(params.command) ? params.command : undefined),
    };
    return {
      args,
      command: params.command,
      cwd: params.cwd,
      env,
      launchKey: JSON.stringify({
        args,
        command: params.command,
        cwd: params.cwd,
        envText: params.envText,
      }),
      // Amp binds `--mode`/`--effort` when a thread is created, so a change must
      // start a fresh session. Folding them into the session config key triggers
      // invalidation in `ensureReady`.
      sessionConfigKey: JSON.stringify({
        agentMode: params.agentMode,
        effort: params.effort,
        permissionMode: params.permissionMode,
        systemPromptKey: params.systemPromptKey,
      }),
    };
  }

  private async startProcess(launchSpec: AmpLaunchSpec): Promise<void> {
    this.process = new AcpSubprocess({
      args: launchSpec.args,
      command: launchSpec.command,
      cwd: launchSpec.cwd,
      env: launchSpec.env,
    });
    this.process.start();

    this.transport = new AcpJsonRpcTransport({
      input: this.process.stdout,
      onClose: (listener) => this.process!.onClose(listener),
      output: this.process.stdin,
    });
    const transport = this.transport;
    this.unregisterTransportClose = transport.onClose(() => {
      if (this.transport === transport) {
        this.setReady(false);
      }
    });

    this.connection = new AcpClientConnection({
      clientCapabilities: {
        auth: { terminal: true },
      },
      clientInfo: {
        name: 'claudian',
        version: this.plugin.manifest?.version ?? '0.0.0',
      },
      delegate: {
        fileSystem: {
          readTextFile: (request) => this.readTextFile(request),
          writeTextFile: (request) => this.writeTextFile(request),
        },
        onSessionNotification: (notification) => this.handleSessionNotification(notification),
        requestPermission: (request) => this.handlePermissionRequest(request),
      },
      transport: this.transport,
    });

    this.transport.start();
    const initResponse = await this.connection.initialize();
    await this.authenticate(initResponse);
    await this.syncInitializeMetadata(initResponse);
    this.setReady(true);
  }

  private async authenticate(initResponse: AcpInitializeResponse): Promise<void> {
    const methods = initResponse.authMethods ?? [];
    if (methods.length === 0) {
      return;
    }

    const method = methods.find(entry => entry.type !== 'env_var' && entry.id === 'amp_login')
      ?? methods.find(entry => entry.type !== 'env_var' && entry.id.toLowerCase().includes('login'))
      ?? methods.find(entry => entry.type !== 'env_var' && entry.id.toLowerCase().includes('browser'))
      ?? methods.find(entry => entry.type !== 'env_var' && entry.id.toLowerCase().includes('amp'))
      ?? methods.find(entry => entry.type !== 'env_var')
      ?? null;
    if (!method) {
      throw new Error('Amp is not authenticated. Run `amp` in a terminal and complete the browser login, then try again.');
    }

    await this.connection!.authenticate({
      methodId: method.id,
      _meta: { headless: false, preferredAuth: 'browser' },
    });
  }

  private async shutdownProcess(): Promise<void> {
    this.setReady(false);
    this.activeTurn?.queue.close();
    this.activeTurn = null;
    this.setSupportedCommands([]);

    this.unregisterTransportClose?.();
    this.unregisterTransportClose = null;

    this.connection?.dispose();
    this.connection = null;

    this.transport?.dispose();
    this.transport = null;

    if (this.process) {
      await this.process.shutdown().catch(() => {});
      this.process = null;
    }
  }

  private async createSession(cwd: string): Promise<string | null> {
    if (!this.connection) {
      return null;
    }

    try {
      this.setSupportedCommands([]);
      const response = await this.connection.newSession({
        cwd,
        mcpServers: [],
      });
      this.loadedSessionId = response.sessionId;
      this.sessionId = response.sessionId;
      this.sessionCwds.set(response.sessionId, cwd);
      await this.applySelectedSessionMode({
        configOptions: response.configOptions ?? null,
        modes: response.modes ?? null,
        sessionId: response.sessionId,
      });
      return response.sessionId;
    } catch {
      return null;
    }
  }

  private async loadSession(sessionId: string, cwd: string): Promise<boolean> {
    if (!this.connection) {
      return false;
    }
    if (this.connection.negotiatedAgentCapabilities?.loadSession === false) {
      return false;
    }

    try {
      this.setSupportedCommands([]);
      const response = await this.connection.loadSession({
        cwd,
        mcpServers: [],
        sessionId,
      });
      this.sessionInvalidated = false;
      this.loadedSessionId = response.sessionId;
      this.sessionId = response.sessionId;
      this.sessionCwds.set(response.sessionId, cwd);
      await this.applySelectedSessionMode({
        configOptions: response.configOptions ?? null,
        modes: response.modes ?? null,
        sessionId: response.sessionId,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async handleSessionNotification(notification: AcpSessionNotification): Promise<void> {
    if (notification.sessionId !== this.sessionId) {
      return;
    }

    const normalized = this.sessionUpdateNormalizer.normalize(notification.update);
    if (normalized.type === 'config_options') {
      return;
    }

    if (normalized.type === 'commands') {
      this.setSupportedCommands(normalized.commands);
      return;
    }

    if (!this.activeTurn || this.activeTurn.sessionId !== notification.sessionId) {
      return;
    }

    switch (normalized.type) {
      case 'message_chunk':
        if (normalized.role === 'assistant' && normalized.messageId) {
          this.currentTurnMetadata.assistantMessageId = normalized.messageId;
        }
        if (normalized.role === 'user' && normalized.messageId) {
          this.currentTurnMetadata.userMessageId = normalized.messageId;
        }
        for (const chunk of normalized.streamChunks) {
          this.activeTurn.queue.push(chunk);
        }
        return;
      case 'tool_call':
      case 'tool_call_update':
        for (const chunk of normalized.streamChunks) {
          this.activeTurn.queue.push(chunk);
        }
        return;
      case 'usage': {
        this.contextUsage = normalized.usage;
        const usage = buildAcpUsageInfo({
          contextWindow: normalized.usage,
          model: this.getActiveDisplayModel(),
          promptUsage: this.promptUsage,
        });
        if (usage) {
          this.activeTurn.queue.push({
            sessionId: notification.sessionId,
            type: 'usage',
            usage,
          });
        }
        return;
      }
      default:
        return;
    }
  }

  private async syncInitializeMetadata(response: AcpInitializeResponse): Promise<void> {
    const meta = getRecord((response as { _meta?: unknown })._meta);
    this.agentVersion = getString(meta.agentVersion)
      ?? response.agentInfo?.version
      ?? this.agentVersion;

    const commands = normalizeAmpCommands(meta.availableCommands);
    if (commands.length > 0) {
      this.setSupportedCommands(commands);
    }
  }

  private async applySelectedSessionMode(params: {
    configOptions?: AcpSessionConfigOption[] | null;
    modes?: AcpSessionModeState | null;
    sessionId: string;
  }): Promise<void> {
    if (!this.connection) {
      return;
    }

    const configOptions = params.configOptions ?? null;
    const providerSettings = this.getProviderSettings();

    const modeState = extractAcpSessionModeState({
      configOptions,
      modes: params.modes ?? null,
    });
    const targetMode = this.resolveSelectedSessionMode(providerSettings, modeState.availableModes);
    if (
      !targetMode
      || modeState.currentModeId === targetMode
      || !modeState.availableModes.some(mode => mode.id === targetMode)
    ) {
      return;
    }

    try {
      await this.connection.setMode({
        modeId: targetMode,
        sessionId: params.sessionId,
      });
    } catch {
      const modeOption = findSelectConfigOption(configOptions, 'mode');
      if (!modeOption || !selectConfigHasValue(modeOption, targetMode)) {
        return;
      }
      await this.connection.setConfigOption({
        configId: modeOption.id,
        sessionId: params.sessionId,
        type: 'select',
        value: targetMode,
      });
    }
  }

  private async handlePermissionRequest(
    request: AcpRequestPermissionRequest,
  ): Promise<AcpRequestPermissionResponse> {
    if (!this.approvalCallback) {
      return { outcome: { outcome: 'cancelled' } };
    }

    const input = normalizeApprovalInput(request.toolCall.rawInput);
    const toolName = request.toolCall.title || request.toolCall.kind || 'tool';
    const blockedPath = extractPermissionPath(input, request.toolCall.locations);
    const decision = await this.approvalCallback(
      formatPermissionLabel(toolName),
      input,
      blockedPath
        ? 'Amp wants to access this path.'
        : `Amp wants permission to use ${formatPermissionLabel(toolName)}.`,
      {
        ...(blockedPath ? { blockedPath } : {}),
        decisionOptions: buildAcpApprovalDecisionOptions(request.options),
      },
    );

    return mapApprovalDecision(decision, request.options);
  }

  private async readTextFile(
    request: AcpReadTextFileRequest,
  ): Promise<{ content: string }> {
    const resolvedPath = this.resolveSessionPath(request.sessionId, request.path);
    const content = await fs.readFile(resolvedPath, 'utf-8');

    if (request.line === undefined && request.limit === undefined) {
      return { content };
    }

    const lines = content.split(/\r?\n/);
    const startIndex = Math.max(0, (request.line ?? 1) - 1);
    const endIndex = request.limit
      ? startIndex + Math.max(0, request.limit)
      : lines.length;

    return {
      content: lines.slice(startIndex, endIndex).join('\n'),
    };
  }

  private async writeTextFile(
    request: AcpWriteTextFileRequest,
  ): Promise<Record<string, never>> {
    const resolvedPath = this.resolveSessionPath(request.sessionId, request.path);
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, request.content, 'utf-8');
    return {};
  }

  private resolveSessionPath(sessionId: string, rawPath: string): string {
    if (path.isAbsolute(rawPath)) {
      return rawPath;
    }

    const cwd = this.sessionCwds.get(sessionId)
      ?? getVaultPath(this.plugin.app)
      ?? process.cwd();
    return path.resolve(cwd, rawPath);
  }

  private getProviderSettings(): Record<string, unknown> {
    return ProviderSettingsCoordinator.getProviderSettingsSnapshot(
      this.plugin.settings,
      this.providerId,
    );
  }

  private resolvePermissionMode(providerSettings: Record<string, unknown>): string {
    const mode = typeof providerSettings.permissionMode === 'string'
      ? providerSettings.permissionMode
      : '';
    return mode === 'yolo' ? 'yolo' : 'normal';
  }

  private resolveSelectedSessionMode(
    providerSettings: Record<string, unknown>,
    availableModes: Array<{ id: string }>,
  ): string {
    const candidates = this.resolvePermissionMode(providerSettings) === 'yolo'
      ? ['bypass', 'accept_all', 'auto']
      : ['default', 'ask', 'normal'];
    for (const candidate of candidates) {
      const mode = availableModes.find(entry => normalizeComparableKey(entry.id) === candidate);
      if (mode) {
        return mode.id;
      }
    }
    return candidates[0];
  }

  private getActiveDisplayModel(): string | undefined {
    const model = this.getProviderSettings().model;
    return typeof model === 'string' && isAmpModelSelectionId(model)
      ? normalizeAmpModelId(model)
      : AMP_MODEL_ID;
  }

  private resolveAmpRequestMeta(
    providerSettings: Record<string, unknown>,
  ): { effort?: string; mode: AmpAgentMode } {
    const model = typeof providerSettings.model === 'string' ? providerSettings.model : '';
    const mode = resolveAmpAgentMode(model);
    if (!ampModeSupportsEffort(mode)) {
      return { mode };
    }

    const effort = normalizeAmpEffort(model, providerSettings.effortLevel);
    return effort ? { effort, mode } : { mode };
  }

  private getAmpSystemPrompt(): string {
    return typeof this.plugin.settings.systemPrompt === 'string'
      ? this.plugin.settings.systemPrompt
      : '';
  }

  private getAmpSystemPromptKey(): string {
    return computeSystemPromptKey({
      customPrompt: this.getAmpSystemPrompt(),
      mediaFolder: this.plugin.settings.mediaFolder,
      userName: this.plugin.settings.userName,
      vaultPath: getVaultPath(this.plugin.app) ?? undefined,
    });
  }

  private setSupportedCommands(commands: SlashCommand[]): void {
    this.supportedCommands = commands.map((command) => ({ ...command }));
    const waiters = this.supportedCommandWaiters.splice(0);
    for (const waiter of waiters) {
      waiter(this.supportedCommands);
    }
  }

  private waitForSupportedCommands(timeoutMs = 250): Promise<SlashCommand[]> {
    if (this.supportedCommands.length > 0) {
      return Promise.resolve([...this.supportedCommands]);
    }

    return new Promise<SlashCommand[]>((resolve) => {
      const waiter = (commands: SlashCommand[]) => {
        window.clearTimeout(timeoutId);
        resolve([...commands]);
      };
      const timeoutId = window.setTimeout(() => {
        const index = this.supportedCommandWaiters.indexOf(waiter);
        if (index >= 0) {
          this.supportedCommandWaiters.splice(index, 1);
        }
        resolve([...this.supportedCommands]);
      }, timeoutMs);

      this.supportedCommandWaiters.push(waiter);
    });
  }

  private setReady(ready: boolean): void {
    if (this.ready === ready) {
      return;
    }

    this.ready = ready;
    for (const listener of this.readyListeners) {
      listener(ready);
    }
  }

  private formatRuntimeError(error: unknown): string {
    const baseMessage = error instanceof Error ? error.message : 'Amp request failed';
    const stderr = this.process?.getStderrSnapshot();
    const message = stderr ? `${baseMessage}\n\n${stderr}` : baseMessage;
    if (!/HTTP\/2 keepalive ping timed out/i.test(message)) {
      return message;
    }

    return `${message}\n\nAmp reported an HTTP/2 keepalive timeout. Check Amp login, VPN/proxy/network settings, then retry. If you use a proxy, add HTTP_PROXY/HTTPS_PROXY in the Amp provider environment.`;
  }

  private clearActiveSession(): void {
    this.sessionId = null;
    this.loadedSessionId = null;
    this.setSupportedCommands([]);
  }
}

function normalizeAmpCommands(value: unknown): SlashCommand[] {
  const commands = Array.isArray(value) ? value as AcpAvailableCommand[] : [];
  const normalized: SlashCommand[] = [];

  for (const command of commands) {
    const name = command.name?.trim().replace(/^\/+/, '');
    if (!name) {
      continue;
    }

    normalized.push({
      argumentHint: command.input?.hint ?? undefined,
      content: '',
      description: command.description ?? undefined,
      id: `${AMP_PROVIDER_ID}:${name}`,
      name,
      source: 'sdk',
    });
  }

  return normalized;
}

function findSelectConfigOption(
  configOptions: AcpSessionConfigOption[] | null | undefined,
  category: 'mode',
): Extract<AcpSessionConfigOption, { type: 'select' }> | null {
  const options = configOptions ?? [];
  const byCategory = options.find((option) => (
    option.type === 'select' && normalizeComparableKey(option.category) === category
  ));
  if (byCategory?.type === 'select') {
    return byCategory;
  }

  const byId = options.find((option) => (
    option.type === 'select' && normalizeComparableKey(option.id) === category
  ));
  return byId?.type === 'select' ? byId : null;
}

function selectConfigHasValue(
  option: Extract<AcpSessionConfigOption, { type: 'select' }>,
  value: string,
): boolean {
  return flattenAcpSessionConfigSelectOptions(option.options)
    .some(entry => entry.value === value);
}

function normalizeComparableKey(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeApprovalInput(rawInput: unknown): Record<string, unknown> {
  if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    return rawInput as Record<string, unknown>;
  }
  if (rawInput === undefined) {
    return {};
  }
  return { value: rawInput };
}

function extractPermissionPath(
  input: Record<string, unknown>,
  locations: Array<{ path: string }> | null | undefined,
): string | undefined {
  for (const key of ['filepath', 'filePath', 'path', 'parentDir']) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  const locationPath = locations?.find((location) => location.path.trim())?.path;
  return locationPath?.trim() || undefined;
}

function mapApprovalDecision(
  decision: ApprovalDecision,
  options: readonly {
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
    optionId: string;
  }[],
): AcpRequestPermissionResponse {
  if (decision === 'allow') {
    return selectPermissionOption(options, ['allow_once', 'allow_always']);
  }

  if (decision === 'allow-always') {
    return selectPermissionOption(options, ['allow_always', 'allow_once']);
  }

  if (decision === 'deny') {
    return selectPermissionOption(options, ['reject_once', 'reject_always']);
  }

  if (typeof decision === 'object' && decision.type === 'select-option') {
    return {
      outcome: {
        optionId: decision.value,
        outcome: 'selected',
      },
    };
  }

  return { outcome: { outcome: 'cancelled' } };
}

function buildAcpApprovalDecisionOptions(
  options: readonly {
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
    name: string;
    optionId: string;
  }[],
): ApprovalDecisionOption[] {
  return options.map((option) => ({
    ...(option.kind === 'allow_once'
      ? { decision: 'allow' as const }
      : option.kind === 'allow_always'
        ? { decision: 'allow-always' as const }
        : {}),
    label: option.name,
    value: option.optionId,
  }));
}

function selectPermissionOption(
  options: readonly {
    kind: 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always';
    optionId: string;
  }[],
  preferredKinds: readonly ('allow_once' | 'allow_always' | 'reject_once' | 'reject_always')[],
): AcpRequestPermissionResponse {
  for (const kind of preferredKinds) {
    const option = options.find((entry) => entry.kind === kind);
    if (option) {
      return {
        outcome: {
          optionId: option.optionId,
          outcome: 'selected',
        },
      };
    }
  }

  return { outcome: { outcome: 'cancelled' } };
}

function formatPermissionLabel(permissionId: string): string {
  return permissionId
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
