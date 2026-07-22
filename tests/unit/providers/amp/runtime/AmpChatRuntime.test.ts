import '@/providers';

import type { AcpSessionConfigOption } from '@/providers/acp';
import { AmpChatRuntime } from '@/providers/amp/runtime/AmpChatRuntime';

function createMockPlugin(): any {
  return {
    app: {
      vault: {
        adapter: {
          basePath: '/tmp/buildian-amp-test-vault',
        },
      },
    },
    getAllViews: jest.fn().mockReturnValue([]),
    getResolvedProviderCliPath: jest.fn().mockReturnValue('/usr/local/bin/amp-acp'),
    manifest: { version: '0.0.0-test' },
    saveSettings: jest.fn().mockResolvedValue(undefined),
    settings: {
      mediaFolder: 'media',
      model: 'amp:high',
      permissionMode: 'normal',
      providerConfigs: {
        amp: { enabled: true },
      },
      settingsProvider: 'amp',
      systemPrompt: '',
      userName: '',
    },
  };
}

describe('AmpChatRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the current Amp mode through ACP session config', async () => {
    const runtime = new AmpChatRuntime(createMockPlugin());
    const configOptions: AcpSessionConfigOption[] = [
      {
        category: 'model',
        currentValue: 'medium',
        id: 'amp-mode',
        name: 'Amp Mode',
        options: [
          { name: 'Low', value: 'low' },
          { name: 'Medium', value: 'medium' },
          { name: 'High', value: 'high' },
          { name: 'Ultra', value: 'ultra' },
        ],
        type: 'select',
      },
      {
        category: 'mode',
        currentValue: 'default',
        id: 'permission',
        name: 'Permissions',
        options: [
          { name: 'Default', value: 'default' },
          { name: 'Bypass', value: 'bypass' },
        ],
        type: 'select',
      },
    ];
    const selectedOptions: AcpSessionConfigOption[] = [
      { ...configOptions[0], currentValue: 'high' } as AcpSessionConfigOption,
      configOptions[1]!,
    ];
    const setConfigOption = jest.fn().mockResolvedValue({ configOptions: selectedOptions });
    const setMode = jest.fn().mockResolvedValue({});
    (runtime as any).connection = { setConfigOption, setMode };

    await (runtime as any).applySelectedSessionConfig({
      configOptions,
      modes: null,
      sessionId: 'amp-session',
    });

    expect(setConfigOption).toHaveBeenCalledWith({
      configId: 'amp-mode',
      sessionId: 'amp-session',
      type: 'select',
      value: 'high',
    });
    expect(setMode).not.toHaveBeenCalled();
  });

  it('sends only the selected mode in legacy request metadata', () => {
    const runtime = new AmpChatRuntime(createMockPlugin());

    expect((runtime as any).resolveAmpRequestMeta({
      effortLevel: 'max',
      model: 'amp:ultra',
    })).toEqual({ mode: 'ultra' });
  });

  it('uses existing Amp CLI login without forcing the adapter setup flow', async () => {
    const runtime = new AmpChatRuntime(createMockPlugin());
    const authenticate = jest.fn().mockResolvedValue({});
    (runtime as any).connection = { authenticate };

    await (runtime as any).authenticate({
      agentInfo: {
        name: 'amp-acp',
        title: 'Amp ACP Agent',
        version: '0.8.1',
      },
      authMethods: [{ id: 'setup', name: 'Amp API Key Setup' }],
      protocolVersion: 1,
    });

    expect(authenticate).not.toHaveBeenCalled();
  });

  it('invalidates sessions by mode without retaining a separate effort value', () => {
    const runtime = new AmpChatRuntime(createMockPlugin());
    const spec = (runtime as any).buildLaunchSpec({
      agentMode: 'high',
      command: 'node',
      cwd: '/tmp/vault',
      envText: '',
      permissionMode: 'normal',
      systemPromptKey: '',
    });

    expect(spec.args.slice(0, 2)).toEqual(['--input-type=module', '--eval']);
    expect(spec.args[2]).toContain("const MODES = ['low', 'medium', 'high', 'ultra']");
    expect(JSON.parse(spec.sessionConfigKey)).toEqual({
      agentMode: 'high',
      permissionMode: 'normal',
      systemPromptKey: '',
    });
  });
});
