const mockGetHostnameKey = jest.fn(() => 'host-a');
const mockGetLegacyHostnameKey = jest.fn(() => 'legacy-host');

jest.mock('../../../../src/utils/env', () => ({
  ...jest.requireActual('../../../../src/utils/env'),
  getHostnameKey: () => mockGetHostnameKey(),
  getLegacyHostnameKey: () => mockGetLegacyHostnameKey(),
}));

import {
  DEFAULT_CURSOR_PROVIDER_SETTINGS,
  getCursorProviderSettings,
  updateCursorProviderSettings,
} from '../../../../src/providers/cursor/settings';

describe('Cursor settings normalization', () => {
  const discoveredModels = [
    { label: 'Auto', rawId: 'default[]' },
    { contextWindow: 200000, label: 'Claude Sonnet', rawId: 'claude-sonnet-4-5[context=200k]' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHostnameKey.mockReturnValue('host-a');
    mockGetLegacyHostnameKey.mockReturnValue('legacy-host');
  });

  it('is disabled by default until the user enables Cursor Agent', () => {
    expect(DEFAULT_CURSOR_PROVIDER_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_CURSOR_PROVIDER_SETTINGS.environmentVariables).toBe('');
  });

  it('normalizes discovered, visible, alias, and CLI path settings', () => {
    const settings = getCursorProviderSettings({
      providerConfigs: {
        'cursor-agent': {
          cliPath: '/legacy/cursor-agent',
          cliPathsByHost: {
            'host-a': ' /host-a/cursor-agent ',
            'host-b': '/host-b/cursor-agent',
          },
          discoveredModels,
          modelAliases: {
            'cursor-agent:default[]': ' Auto ',
            unknown: 'ignored',
          },
          visibleModels: [
            'cursor-agent:default[]',
            'claude-sonnet-4-5[context=200k]',
            'default[]',
          ],
        },
      },
    });

    expect(settings).toMatchObject({
      cliPath: '/legacy/cursor-agent',
      cliPathsByHost: {
        'host-a': '/host-a/cursor-agent',
        'host-b': '/host-b/cursor-agent',
      },
      modelAliases: {
        'claude-4.6-opus-max-thinking': 'Auto',
      },
      visibleModels: [
        'claude-4.6-opus-max-thinking',
        'claude-sonnet-4-5[context=200k]',
      ],
    });
  });

  it('migrates the current legacy hostname-scoped CLI path to the opaque device key', () => {
    mockGetHostnameKey.mockReturnValue('device:current');
    mockGetLegacyHostnameKey.mockReturnValue('host-a');

    const settings = getCursorProviderSettings({
      providerConfigs: {
        'cursor-agent': {
          cliPathsByHost: {
            'host-a': '/host-a/cursor-agent',
            'host-b': '/host-b/cursor-agent',
          },
        },
      },
    });

    expect(settings.cliPathsByHost).toEqual({
      'device:current': '/host-a/cursor-agent',
      'host-b': '/host-b/cursor-agent',
    });
  });

  it('prunes aliases when visible models are narrowed', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'cursor-agent': {
          discoveredModels,
          modelAliases: {
            'default[]': 'Auto',
            'claude-sonnet-4-5[context=200k]': 'Sonnet',
          },
          visibleModels: [
            'default[]',
            'claude-sonnet-4-5[context=200k]',
          ],
        },
      },
    };

    const next = updateCursorProviderSettings(settings, {
      visibleModels: ['default[]'],
    });

    expect(next.modelAliases).toEqual({ 'claude-4.6-opus-max-thinking': 'Auto' });
    expect(next.visibleModels).toEqual(['claude-4.6-opus-max-thinking']);
  });
});
