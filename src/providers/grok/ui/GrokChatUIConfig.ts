import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { GROK_PROVIDER_ICON } from '../../../shared/icons';
import {
  buildGrokDefaultModelOptions,
  decodeGrokModelId,
  encodeGrokModelId,
  getGrokReasoningOptions,
  GROK_DEFAULT_MODEL_ID,
  GROK_DEFAULT_REASONING_LEVEL,
  isGrokModelSelectionId,
  normalizeGrokReasoningLevel,
} from '../models';
import {
  getGrokProviderSettings,
  updateGrokProviderSettings,
} from '../settings';

const DEFAULT_CONTEXT_WINDOW = 512_000;
const GROK_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Ask',
  activeValue: 'yolo',
  activeLabel: 'Always',
  planValue: 'plan',
  planLabel: 'Plan',
};

export const grokChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings): ProviderUIOption[] {
    const grokSettings = getGrokProviderSettings(settings);
    const defaultOptions = buildGrokDefaultModelOptions();
    const discoveredOptions = new Map(grokSettings.discoveredModels.map((model) => [
      encodeGrokModelId(model.rawId),
      {
        description: model.description ?? 'CLI runtime',
        label: grokSettings.modelAliases[model.rawId] ?? model.label,
        value: encodeGrokModelId(model.rawId),
      } satisfies ProviderUIOption,
    ]));
    const options: ProviderUIOption[] = [];
    const seen = new Set<string>();

    const rawVisibleModels = grokSettings.visibleModels.length > 0
      ? grokSettings.visibleModels
      : [GROK_DEFAULT_MODEL_ID];
    for (const rawId of rawVisibleModels) {
      const encodedId = encodeGrokModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId)
          ?? defaultOptions.find(option => option.value === encodedId)
          ?? {
            description: 'Configured model',
            label: grokSettings.modelAliases[rawId] ?? rawId,
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
      typeof savedProviderModel?.grok === 'string' ? savedProviderModel.grok : '',
    ];

    for (const model of selectedModelValues) {
      const rawId = decodeGrokModelId(model);
      if (!rawId) {
        continue;
      }
      const encodedId = encodeGrokModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId) ?? {
          description: 'Selected in an existing session',
          label: grokSettings.modelAliases[rawId] ?? rawId,
          value: encodedId,
        },
      );
    }

    return options.length > 0 ? options : defaultOptions;
  },

  ownsModel(model: string): boolean {
    return isGrokModelSelectionId(model);
  },

  isAdaptiveReasoningModel(model: string): boolean {
    return isGrokModelSelectionId(model);
  },

  getReasoningOptions(): ProviderReasoningOption[] {
    return getGrokReasoningOptions();
  },

  getDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
    const rawId = decodeGrokModelId(model);
    if (!rawId) {
      return GROK_DEFAULT_REASONING_LEVEL;
    }

    return normalizeGrokReasoningLevel(
      getGrokProviderSettings(settings).preferredEffortByModel[rawId],
    );
  },

  getContextWindowSize(
    model: string,
    customLimits?: Record<string, number>,
    settings?: Record<string, unknown>,
  ): number {
    const rawId = decodeGrokModelId(model);
    const metadataContextWindow = rawId && settings
      ? getGrokProviderSettings(settings).discoveredModels
        .find(entry => entry.rawId === rawId)?.contextWindow
      : undefined;
    return metadataContextWindow ?? customLimits?.[model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return isGrokModelSelectionId(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const rawId = decodeGrokModelId(model);
    if (!rawId) {
      settingsBag.effortLevel = GROK_DEFAULT_REASONING_LEVEL;
      return;
    }

    settingsBag.model = encodeGrokModelId(rawId);
    settingsBag.effortLevel = getGrokDefaultReasoningValue(model, settingsBag);
  },

  applyReasoningSelection(model: string, value: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const rawId = decodeGrokModelId(model);
    if (!rawId) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const nextPreferred = {
      ...getGrokProviderSettings(settingsBag).preferredEffortByModel,
    };
    const normalized = normalizeGrokReasoningLevel(value);
    if (normalized === GROK_DEFAULT_REASONING_LEVEL) {
      delete nextPreferred[rawId];
    } else {
      nextPreferred[rawId] = normalized;
    }
    updateGrokProviderSettings(settingsBag, { preferredEffortByModel: nextPreferred });
  },

  normalizeModelVariant(model: string): string {
    const rawId = decodeGrokModelId(model);
    return rawId ? encodeGrokModelId(rawId) : model;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return GROK_PERMISSION_MODE_TOGGLE;
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
    return GROK_PROVIDER_ICON;
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

function getGrokDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
  return grokChatUIConfig.getDefaultReasoningValue(model, settings);
}
