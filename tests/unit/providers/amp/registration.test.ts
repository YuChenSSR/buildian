import '@/providers';

import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import { AMP_PROVIDER_ID } from '@/providers/amp/models';
import { ampProviderRegistration } from '@/providers/amp/registration';

function createPlugin(): any {
  return {
    app: {
      vault: {
        adapter: {
          basePath: '/tmp/amp-vault',
        },
      },
    },
    getAllViews: jest.fn(() => []),
    getResolvedProviderCliPath: jest.fn(() => 'acp-amp'),
    manifest: { version: '0.0.0-test' },
    saveSettings: jest.fn(),
    settings: {
      mediaFolder: 'media',
      providerConfigs: {
        amp: {
          enabled: true,
        },
      },
      systemPrompt: '',
      userName: '',
    },
  };
}

describe('Amp provider registration', () => {
  it('registers Amp metadata and runtime factories', () => {
    expect(ampProviderRegistration.displayName).toBe('Amp');
    expect(ampProviderRegistration.isEnabled({ providerConfigs: { amp: { enabled: true } } })).toBe(true);
    expect(ampProviderRegistration.isEnabled({ providerConfigs: { amp: { enabled: false } } })).toBe(false);
    expect(ampProviderRegistration.environmentKeyPatterns?.some(pattern => pattern.test('ACP_AMP_DRIVER'))).toBe(true);
    expect(ampProviderRegistration.environmentKeyPatterns?.some(pattern => pattern.test('AMP_API_KEY'))).toBe(true);

    const runtime = ampProviderRegistration.createRuntime({ plugin: createPlugin() });
    expect(runtime.providerId).toBe(AMP_PROVIDER_ID);
    runtime.cleanup();
  });

  it('routes Amp model ids through the provider registry', () => {
    const settings = {
      providerConfigs: {
        amp: { enabled: true },
      },
    };

    expect(ProviderRegistry.resolveProviderForModel('amp', settings)).toBe('amp');
    expect(ProviderRegistry.getEnabledProviderIds(settings)).toContain('amp');
    expect(ProviderRegistry.getEnabledProviderIds({ providerConfigs: { amp: { enabled: false } } })).not.toContain('amp');
  });
});
