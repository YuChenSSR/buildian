import type { ProviderConfigMap } from '../core/types/settings';
import { CURSOR_PROVIDER_ID } from './cursor/models';
import { DEFAULT_CURSOR_PROVIDER_SETTINGS } from './cursor/settings';
import { DEFAULT_GROK_PROVIDER_SETTINGS } from './grok/settings';

export function getBuiltInProviderDefaultConfigs(): ProviderConfigMap {
  return {
    [CURSOR_PROVIDER_ID]: { ...DEFAULT_CURSOR_PROVIDER_SETTINGS, enabled: false },
    grok: { ...DEFAULT_GROK_PROVIDER_SETTINGS, enabled: true },
  };
}
