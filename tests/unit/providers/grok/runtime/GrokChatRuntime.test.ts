import type { AcpInitializeResponse } from '@/providers/acp';
import { GrokChatRuntime } from '@/providers/grok/runtime/GrokChatRuntime';
import { getGrokProviderSettings } from '@/providers/grok/settings';

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
  return {
    settings: {
      providerConfigs: {
        grok: {
          enabled: true,
        },
      },
    },
    manifest: { version: '0.0.0-test' },
    getAllViews: jest.fn().mockReturnValue([]),
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/usr/local/bin/grok'),
    saveSettings: jest.fn().mockResolvedValue(undefined),
    app: {
      vault: {
        adapter: {
          basePath: '/tmp/claudian-test-vault',
        },
      },
    },
    ...overrides,
  };
}

describe('GrokChatRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the Grok ACP stdio launch arguments', () => {
    const runtime = new GrokChatRuntime(createMockPlugin());

    const spec = (runtime as any).buildLaunchSpec({
      command: '/usr/local/bin/grok',
      cwd: '/tmp/vault',
      effort: 'max',
      envText: 'XAI_API_KEY=test-key',
      model: 'grok-build',
      permissionMode: 'yolo',
    });

    expect(spec.command).toBe('/usr/local/bin/grok');
    expect(spec.cwd).toBe('/tmp/vault');
    expect(spec.args).toEqual([
      '--no-auto-update',
      'agent',
      '--model',
      'grok-build',
      '--reasoning-effort',
      'max',
      '--always-approve',
      'stdio',
    ]);
    expect(spec.env.XAI_API_KEY).toBe('test-key');
  });

  it('passes plan mode as a root CLI option', () => {
    const runtime = new GrokChatRuntime(createMockPlugin());

    const spec = (runtime as any).buildLaunchSpec({
      command: 'grok',
      cwd: '/tmp/vault',
      effort: 'high',
      envText: '',
      model: 'grok-build',
      permissionMode: 'plan',
    });

    expect(spec.args).toEqual([
      '--no-auto-update',
      '--permission-mode',
      'plan',
      'agent',
      '--model',
      'grok-build',
      '--reasoning-effort',
      'high',
      'stdio',
    ]);
  });

  it('authenticates with cached Grok login state in headless mode', async () => {
    const runtime = new GrokChatRuntime(createMockPlugin());
    const authenticate = jest.fn().mockResolvedValue({});
    (runtime as any).connection = { authenticate };

    await (runtime as any).authenticate({
      authMethods: [
        { id: 'grok.com', name: 'Sign in with Grok' },
        { id: 'cached_token', name: 'Cached token' },
      ],
      protocolVersion: 1,
    } satisfies AcpInitializeResponse);

    expect(authenticate).toHaveBeenCalledWith({
      methodId: 'cached_token',
      _meta: { headless: true },
    });
  });

  it('falls back to xAI API key authentication when no cached login is advertised', async () => {
    const runtime = new GrokChatRuntime(createMockPlugin());
    const authenticate = jest.fn().mockResolvedValue({});
    (runtime as any).connection = { authenticate };

    await (runtime as any).authenticate({
      authMethods: [
        { id: 'xai.api_key', name: 'xAI API key' },
      ],
      protocolVersion: 1,
    } satisfies AcpInitializeResponse);

    expect(authenticate).toHaveBeenCalledWith({
      methodId: 'xai.api_key',
      _meta: { headless: true },
    });
  });

  it('syncs available Grok commands and model metadata from initialize meta', async () => {
    const plugin = createMockPlugin();
    const runtime = new GrokChatRuntime(plugin);

    await (runtime as any).syncInitializeMetadata({
      protocolVersion: 1,
      _meta: {
        agentVersion: '0.2.16',
        availableCommands: [
          { name: 'compact', description: 'Compact context', input: { hint: '$1' } },
          { name: '/context', description: 'Show context' },
        ],
        modelState: {
          availableModels: [
            {
              label: 'Grok Build',
              rawId: 'grok-build',
              _meta: { totalContextTokens: 512000 },
            },
          ],
          currentModelId: 'grok-build',
        },
      },
    } as AcpInitializeResponse);

    await expect(runtime.getSupportedCommands()).resolves.toEqual([
      {
        id: 'grok:compact',
        name: 'compact',
        description: 'Compact context',
        argumentHint: '$1',
        content: '',
        source: 'sdk',
      },
      {
        id: 'grok:context',
        name: 'context',
        description: 'Show context',
        argumentHint: undefined,
        content: '',
        source: 'sdk',
      },
    ]);
    expect(getGrokProviderSettings(plugin.settings).discoveredModels).toEqual([
      {
        contextWindow: 512000,
        label: 'Grok Build',
        rawId: 'grok-build',
      },
    ]);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
    expect(runtime.buildSessionUpdates({
      conversation: null,
      sessionInvalidated: false,
    }).updates.providerState).toEqual({ agentVersion: '0.2.16' });
  });
});
