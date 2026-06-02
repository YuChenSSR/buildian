const mockGetHostnameKey = jest.fn(() => 'host-a');
const mockGetLegacyHostnameKey = jest.fn(() => 'legacy-host');

jest.mock('../../../../src/utils/env', () => ({
  ...jest.requireActual('../../../../src/utils/env'),
  getHostnameKey: () => mockGetHostnameKey(),
  getLegacyHostnameKey: () => mockGetLegacyHostnameKey(),
}));

import {
  DEFAULT_GROK_PROVIDER_SETTINGS,
  getGrokProviderSettings,
  updateGrokProviderSettings,
} from '../../../../src/providers/grok/settings';

describe('Grok settings normalization', () => {
  const discoveredModels = [
    { label: 'Grok Composer Fast', rawId: 'grok-composer-2.5-fast' },
    { contextWindow: 512000, label: 'Grok Build', rawId: 'grok-build' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHostnameKey.mockReturnValue('host-a');
    mockGetLegacyHostnameKey.mockReturnValue('legacy-host');
  });

  it('is disabled by default until the user enables Grok', () => {
    expect(DEFAULT_GROK_PROVIDER_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_GROK_PROVIDER_SETTINGS.environmentVariables).toBe('');
  });

  it('normalizes discovered, visible, alias, effort, and CLI path settings', () => {
    const settings = getGrokProviderSettings({
      providerConfigs: {
        grok: {
          cliPath: '/legacy/grok',
          cliPathsByHost: {
            'host-a': ' /host-a/grok ',
            'host-b': '/host-b/grok',
          },
          discoveredModels,
          modelAliases: {
            'grok:grok-build': ' Build ',
            unknown: 'ignored',
          },
          preferredEffortByModel: {
            'grok:grok-build': 'max',
            unknown: 'low',
          },
          visibleModels: [
            'grok:grok-build',
            'grok-composer-2.5-fast',
            'grok-build',
          ],
        },
      },
    });

    expect(settings).toMatchObject({
      cliPath: '/legacy/grok',
      cliPathsByHost: {
        'host-a': '/host-a/grok',
        'host-b': '/host-b/grok',
      },
      modelAliases: {
        'grok-build': 'Build',
      },
      preferredEffortByModel: {
        'grok-build': 'max',
      },
      visibleModels: [
        'grok-build',
        'grok-composer-2.5-fast',
      ],
    });
  });

  it('migrates the current legacy hostname-scoped CLI path to the opaque device key', () => {
    mockGetHostnameKey.mockReturnValue('device:current');
    mockGetLegacyHostnameKey.mockReturnValue('host-a');

    const settings = getGrokProviderSettings({
      providerConfigs: {
        grok: {
          cliPathsByHost: {
            'host-a': '/host-a/grok',
            'host-b': '/host-b/grok',
          },
        },
      },
    });

    expect(settings.cliPathsByHost).toEqual({
      'device:current': '/host-a/grok',
      'host-b': '/host-b/grok',
    });
  });

  it('prunes aliases and preferred effort when visible models are narrowed', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        grok: {
          discoveredModels,
          modelAliases: {
            'grok-build': 'Build',
            'grok-composer-2.5-fast': 'Composer',
          },
          preferredEffortByModel: {
            'grok-build': 'max',
            'grok-composer-2.5-fast': 'low',
          },
          visibleModels: [
            'grok-build',
            'grok-composer-2.5-fast',
          ],
        },
      },
    };

    const next = updateGrokProviderSettings(settings, {
      visibleModels: ['grok-build'],
    });

    expect(next.modelAliases).toEqual({ 'grok-build': 'Build' });
    expect(next.preferredEffortByModel).toEqual({ 'grok-build': 'max' });
    expect(next.visibleModels).toEqual(['grok-build']);
  });
});
