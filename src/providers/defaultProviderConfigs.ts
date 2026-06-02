import type { ProviderConfigMap } from '../core/types/settings';
import { DEFAULT_GROK_PROVIDER_SETTINGS } from './grok/settings';

export function getBuiltInProviderDefaultConfigs(): ProviderConfigMap {
  return {
    grok: { ...DEFAULT_GROK_PROVIDER_SETTINGS, enabled: true },
  };
}
