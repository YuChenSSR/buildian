import type { AcpInitializeResponse, AcpSessionConfigOption } from '@/providers/acp';
import { CursorChatRuntime } from '@/providers/cursor/runtime/CursorChatRuntime';
import { getCursorProviderSettings } from '@/providers/cursor/settings';

function createMockPlugin(overrides: Record<string, unknown> = {}): any {
  return {
    settings: {
      providerConfigs: {
        'cursor-agent': {
          enabled: true,
        },
      },
    },
    manifest: { version: '0.0.0-test' },
    getAllViews: jest.fn().mockReturnValue([]),
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/usr/local/bin/cursor-agent'),
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

describe('CursorChatRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('builds the Cursor ACP launch arguments', () => {
    const runtime = new CursorChatRuntime(createMockPlugin());

    const spec = (runtime as any).buildLaunchSpec({
      command: '/usr/local/bin/cursor-agent',
      cwd: '/tmp/vault',
      envText: 'CURSOR_API_KEY=test-key',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'yolo',
      systemPromptKey: '',
    });

    expect(spec.command).toBe('/usr/local/bin/cursor-agent');
    expect(spec.cwd).toBe('/tmp/vault');
    expect(spec.args).toEqual([
      '--model',
      'claude-4.6-opus-max-thinking',
      '--force',
      'acp',
    ]);
    expect(spec.env.CURSOR_API_KEY).toBe('test-key');
  });

  it('includes plan mode in the launch key so an active session restarts into plan', () => {
    const runtime = new CursorChatRuntime(createMockPlugin());

    const normal = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'normal',
      systemPromptKey: '',
    });
    const plan = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'plan',
      systemPromptKey: '',
    });

    expect(normal.args).toEqual(['--model', 'claude-4.6-opus-max-thinking', 'acp']);
    expect(plan.args).toEqual(['--model', 'claude-4.6-opus-max-thinking', 'acp']);
    expect(normal.launchKey).not.toEqual(plan.launchKey);
  });

  it('passes public model ids to the CLI but keeps ACP bracket ids inside the session', () => {
    const runtime = new CursorChatRuntime(createMockPlugin());

    const high = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-opus-4-6[context=200k,effort=high]',
      permissionMode: 'normal',
      systemPromptKey: '',
    });
    const max = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'normal',
      systemPromptKey: '',
    });

    expect(high.args).toEqual(['acp']);
    expect(max.args).toEqual(['--model', 'claude-4.6-opus-max-thinking', 'acp']);
    expect(high.launchKey).not.toEqual(max.launchKey);
  });

  it('includes the system prompt key in the launch key', () => {
    const runtime = new CursorChatRuntime(createMockPlugin());

    const plain = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'normal',
      systemPromptKey: '',
    });
    const withPrompt = (runtime as any).buildLaunchSpec({
      command: 'cursor-agent',
      cwd: '/tmp/vault',
      envText: '',
      model: 'claude-4.6-opus-max-thinking',
      permissionMode: 'normal',
      systemPromptKey: 'formula-format',
    });

    expect(plain.launchKey).not.toEqual(withPrompt.launchKey);
  });

  it('authenticates with Cursor login state in headless mode', async () => {
    const runtime = new CursorChatRuntime(createMockPlugin());
    const authenticate = jest.fn().mockResolvedValue({});
    (runtime as any).connection = { authenticate };

    await (runtime as any).authenticate({
      authMethods: [
        { id: 'cursor_login', name: 'Cursor Login' },
      ],
      protocolVersion: 1,
    } satisfies AcpInitializeResponse);

    expect(authenticate).toHaveBeenCalledWith({
      methodId: 'cursor_login',
      _meta: { headless: true },
    });
  });

  it('persists the Cursor session config key with provider state', () => {
    const runtime = new CursorChatRuntime(createMockPlugin());
    (runtime as any).currentSessionConfigKey = '{"model":"claude-4.6-opus-max-thinking"}';
    (runtime as any).sessionId = 'cursor-session';

    const result = runtime.buildSessionUpdates({
      conversation: null,
      sessionInvalidated: false,
    });

    expect(result.updates).toMatchObject({
      providerState: {
        sessionConfigKey: '{"model":"claude-4.6-opus-max-thinking"}',
      },
      sessionId: 'cursor-session',
    });
  });

  it('syncs available Cursor model metadata from ACP config options', async () => {
    const plugin = createMockPlugin();
    const runtime = new CursorChatRuntime(plugin);
    const configOptions: AcpSessionConfigOption[] = [{
      category: 'model',
      currentValue: 'default[]',
      id: 'model',
      name: 'Model',
      options: [
        { name: 'Auto', value: 'default[]' },
        { name: 'Claude Sonnet', value: 'claude-sonnet-4-5[context=200k]' },
      ],
      type: 'select',
    }];

    await (runtime as any).syncSessionModelState({ configOptions });

    expect(getCursorProviderSettings(plugin.settings).discoveredModels).toEqual([
      {
        label: 'Auto',
        rawId: 'default[]',
      },
      {
        contextWindow: 200000,
        label: 'Claude Sonnet',
        rawId: 'claude-sonnet-4-5[context=200k]',
      },
    ]);
    expect(plugin.saveSettings).toHaveBeenCalledTimes(1);
  });
});
