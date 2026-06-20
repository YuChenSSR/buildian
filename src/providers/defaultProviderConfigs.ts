import type { ProviderConfigMap } from '../core/types/settings';
import { AMP_PROVIDER_ID } from './amp/models';
import { DEFAULT_AMP_PROVIDER_SETTINGS } from './amp/settings';
import { CURSOR_PROVIDER_ID } from './cursor/models';
import { DEFAULT_CURSOR_PROVIDER_SETTINGS } from './cursor/settings';
import { DROID_PROVIDER_ID } from './droid/models';
import { DEFAULT_DROID_PROVIDER_SETTINGS } from './droid/settings';
import { DEFAULT_GROK_PROVIDER_SETTINGS } from './grok/settings';

export function getBuiltInProviderDefaultConfigs(): ProviderConfigMap {
  return {
    [AMP_PROVIDER_ID]: { ...DEFAULT_AMP_PROVIDER_SETTINGS, enabled: false },
    [CURSOR_PROVIDER_ID]: { ...DEFAULT_CURSOR_PROVIDER_SETTINGS, enabled: false },
    [DROID_PROVIDER_ID]: { ...DEFAULT_DROID_PROVIDER_SETTINGS, enabled: false },
    grok: { ...DEFAULT_GROK_PROVIDER_SETTINGS, enabled: true },
  };
}
