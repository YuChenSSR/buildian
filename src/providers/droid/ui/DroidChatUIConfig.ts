import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { DROID_PROVIDER_ICON } from '../../../shared/icons';
import {
  buildDroidDefaultModelOptions,
  decodeDroidModelId,
  DROID_DEFAULT_MODEL_ID,
  DROID_DEFAULT_REASONING_LEVEL,
  DROID_PROVIDER_ID,
  encodeDroidModelId,
  getDroidReasoningOptions,
  isDroidModelSelectionId,
  normalizeDroidReasoningLevel,
  normalizeRawModelId,
} from '../models';
import {
  getDroidProviderSettings,
  updateDroidProviderSettings,
} from '../settings';

const DEFAULT_CONTEXT_WINDOW = 200_000;
const DROID_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Read',
  activeValue: 'yolo',
  activeLabel: 'Auto',
  planValue: 'plan',
  planLabel: 'Spec',
};

export const droidChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings): ProviderUIOption[] {
    const droidSettings = getDroidProviderSettings(settings);
    const defaultOptions = buildDroidDefaultModelOptions();
    const discoveredOptions = new Map(droidSettings.discoveredModels.map((model) => [
      encodeDroidModelId(model.rawId),
      {
        description: model.description ?? 'CLI runtime',
        label: droidSettings.modelAliases[model.rawId] ?? model.label,
        value: encodeDroidModelId(model.rawId),
      } satisfies ProviderUIOption,
    ]));
    const options: ProviderUIOption[] = [];
    const seen = new Set<string>();

    const rawVisibleModels = droidSettings.visibleModels.length > 0
      ? droidSettings.visibleModels
      : [DROID_DEFAULT_MODEL_ID];
    for (const rawId of rawVisibleModels) {
      const encodedId = encodeDroidModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId)
          ?? defaultOptions.find(option => option.value === encodedId)
          ?? {
            description: 'Configured model',
            label: droidSettings.modelAliases[rawId] ?? rawId,
            value: encodedId,
          },
      );
    }

    const savedProviderModel = (
      settings.savedProviderModel
      && typeof settings.savedProviderModel === 'object'
      && !Array.isArray(settings.savedProviderModel)
    )
      ? settings.savedProviderModel as Record<string, unknown>
      : null;
    const selectedModelValues = [
      typeof settings.model === 'string' ? settings.model : '',
      typeof savedProviderModel?.[DROID_PROVIDER_ID] === 'string'
        ? savedProviderModel[DROID_PROVIDER_ID]
        : '',
    ];

    for (const model of selectedModelValues) {
      const rawId = normalizeDecodedRawModelId(model);
      if (!rawId) {
        continue;
      }
      const encodedId = encodeDroidModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId) ?? {
          description: 'Selected in an existing session',
          label: droidSettings.modelAliases[rawId] ?? rawId,
          value: encodedId,
        },
      );
    }

    return options.length > 0 ? options : defaultOptions;
  },

  ownsModel(model: string): boolean {
    return isDroidModelSelectionId(model);
  },

  isAdaptiveReasoningModel(model: string): boolean {
    return isDroidModelSelectionId(model);
  },

  getReasoningOptions(model: string): ProviderReasoningOption[] {
    return isDroidModelSelectionId(model) ? getDroidReasoningOptions() : [];
  },

  getDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
    const rawId = normalizeDecodedRawModelId(model);
    if (!rawId) {
      return DROID_DEFAULT_REASONING_LEVEL;
    }

    const droidSettings = getDroidProviderSettings(settings);
    return normalizeDroidReasoningLevel(
      droidSettings.preferredEffortByModel[rawId]
        ?? DROID_DEFAULT_REASONING_LEVEL,
    );
  },

  getContextWindowSize(
    model: string,
    customLimits?: Record<string, number>,
    settings?: Record<string, unknown>,
  ): number {
    const rawId = normalizeDecodedRawModelId(model);
    const metadataContextWindow = rawId && settings
      ? getDroidProviderSettings(settings).discoveredModels
        .find(entry => entry.rawId === rawId)?.contextWindow
      : undefined;
    return metadataContextWindow ?? customLimits?.[model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return isDroidModelSelectionId(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const rawId = normalizeDecodedRawModelId(model);
    if (!rawId) {
      settingsBag.effortLevel = DROID_DEFAULT_REASONING_LEVEL;
      return;
    }

    settingsBag.model = encodeDroidModelId(rawId);
    settingsBag.effortLevel = getDroidDefaultReasoningValue(model, settingsBag);
  },

  applyReasoningSelection(model: string, value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const rawId = normalizeDecodedRawModelId(model);
    if (!rawId) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const nextPreferred = {
      ...getDroidProviderSettings(settingsBag).preferredEffortByModel,
    };
    const normalized = normalizeDroidReasoningLevel(value);
    if (normalized === DROID_DEFAULT_REASONING_LEVEL) {
      delete nextPreferred[rawId];
    } else {
      nextPreferred[rawId] = normalized;
    }
    updateDroidProviderSettings(settingsBag, { preferredEffortByModel: nextPreferred });
  },

  normalizeModelVariant(model: string): string {
    const rawId = normalizeDecodedRawModelId(model);
    return rawId ? encodeDroidModelId(rawId) : model;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return DROID_PERMISSION_MODE_TOGGLE;
  },

  resolvePermissionMode(settings: Record<string, unknown>): string | null {
    return typeof settings.permissionMode === 'string'
      && ['normal', 'plan', 'yolo'].includes(settings.permissionMode)
      ? settings.permissionMode
      : null;
  },

  applyPermissionMode(value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    (settings as Record<string, unknown>).permissionMode = value;
  },

  getModeSelector(): null {
    return null;
  },

  getProviderIcon() {
    return DROID_PROVIDER_ICON;
  },
};

function pushOption(
  target: ProviderUIOption[],
  seenValues: Set<string>,
  value: string,
  option: ProviderUIOption,
): void {
  if (seenValues.has(value)) {
    return;
  }

  seenValues.add(value);
  target.push(option);
}

function normalizeDecodedRawModelId(model: string): string | null {
  const rawId = decodeDroidModelId(model);
  return rawId ? normalizeRawModelId(rawId) : null;
}

function getDroidDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
  return droidChatUIConfig.getDefaultReasoningValue(model, settings);
}
