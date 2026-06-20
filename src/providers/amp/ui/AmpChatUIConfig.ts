import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { AMP_PROVIDER_ICON } from '../../../shared/icons';
import {
  AMP_CONTEXT_WINDOW,
  buildAmpModelOptions,
  getAmpDefaultEffort,
  getAmpReasoningOptions,
  isAmpModelSelectionId,
  normalizeAmpModelId,
} from '../models';

const AMP_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Ask',
  activeValue: 'yolo',
  activeLabel: 'Bypass',
};

export const ampChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(_settings): ProviderUIOption[] {
    return buildAmpModelOptions();
  },

  ownsModel(model: string): boolean {
    return isAmpModelSelectionId(model);
  },

  isAdaptiveReasoningModel(_model: string): boolean {
    return true;
  },

  getReasoningOptions(model: string): ProviderReasoningOption[] {
    return isAmpModelSelectionId(model) ? getAmpReasoningOptions(model) : [];
  },

  getDefaultReasoningValue(model: string): string {
    return getAmpDefaultEffort(model);
  },

  getContextWindowSize(
    model: string,
    customLimits?: Record<string, number>,
  ): number {
    return customLimits?.[model] ?? AMP_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return isAmpModelSelectionId(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    settingsBag.model = normalizeAmpModelId(model);
    settingsBag.effortLevel = getAmpDefaultEffort(model);
  },

  applyReasoningSelection(_model: string, _value: string, _settings: unknown): void {},

  normalizeModelVariant(model: string): string {
    return isAmpModelSelectionId(model) ? normalizeAmpModelId(model) : model;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return AMP_PERMISSION_MODE_TOGGLE;
  },

  resolvePermissionMode(settings: Record<string, unknown>): string | null {
    return typeof settings.permissionMode === 'string'
      && ['normal', 'yolo'].includes(settings.permissionMode)
      ? settings.permissionMode
      : null;
  },

  applyPermissionMode(value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    (settings as Record<string, unknown>).permissionMode = value === 'yolo' ? 'yolo' : 'normal';
  },

  getModeSelector(): null {
    return null;
  },

  getProviderIcon() {
    return AMP_PROVIDER_ICON;
  },
};
