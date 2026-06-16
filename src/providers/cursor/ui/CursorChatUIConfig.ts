import type {
  ProviderChatUIConfig,
  ProviderPermissionModeToggleConfig,
  ProviderReasoningOption,
  ProviderUIOption,
} from '../../../core/providers/types';
import { CURSOR_PROVIDER_ICON } from '../../../shared/icons';
import {
  buildCursorDefaultModelOptions,
  CURSOR_DEFAULT_MODEL_ID,
  CURSOR_DEFAULT_REASONING_LEVEL,
  CURSOR_PROVIDER_ID,
  decodeCursorModelId,
  encodeCursorModelId,
  getCursorReasoningOptions,
  isCursorModelSelectionId,
  normalizeCursorReasoningLevel,
  normalizeRawModelId,
} from '../models';
import {
  getCursorProviderSettings,
  updateCursorProviderSettings,
} from '../settings';

const DEFAULT_CONTEXT_WINDOW = 200_000;
const CURSOR_PERMISSION_MODE_TOGGLE: ProviderPermissionModeToggleConfig = {
  inactiveValue: 'normal',
  inactiveLabel: 'Agent',
  activeValue: 'yolo',
  activeLabel: 'Force',
  planValue: 'plan',
  planLabel: 'Plan',
};

export const cursorChatUIConfig: ProviderChatUIConfig = {
  getModelOptions(settings): ProviderUIOption[] {
    const cursorSettings = getCursorProviderSettings(settings);
    const defaultOptions = buildCursorDefaultModelOptions();
    const discoveredOptions = new Map(cursorSettings.discoveredModels.map((model) => [
      encodeCursorModelId(model.rawId),
      {
        description: model.description ?? 'CLI runtime',
        label: cursorSettings.modelAliases[model.rawId] ?? model.label,
        value: encodeCursorModelId(model.rawId),
      } satisfies ProviderUIOption,
    ]));
    const options: ProviderUIOption[] = [];
    const seen = new Set<string>();

    const rawVisibleModels = cursorSettings.visibleModels.length > 0
      ? cursorSettings.visibleModels
      : [CURSOR_DEFAULT_MODEL_ID];
    for (const rawId of rawVisibleModels) {
      const encodedId = encodeCursorModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId)
          ?? defaultOptions.find(option => option.value === encodedId)
          ?? {
            description: 'Configured model',
            label: cursorSettings.modelAliases[rawId] ?? rawId,
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
      typeof savedProviderModel?.[CURSOR_PROVIDER_ID] === 'string'
        ? savedProviderModel[CURSOR_PROVIDER_ID]
        : '',
    ];

    for (const model of selectedModelValues) {
      const rawId = normalizeDecodedRawModelId(model);
      if (!rawId) {
        continue;
      }
      const encodedId = encodeCursorModelId(rawId);
      pushOption(
        options,
        seen,
        encodedId,
        discoveredOptions.get(encodedId) ?? {
          description: 'Selected in an existing session',
          label: cursorSettings.modelAliases[rawId] ?? rawId,
          value: encodedId,
        },
      );
    }

    return options.length > 0 ? options : defaultOptions;
  },

  ownsModel(model: string): boolean {
    return isCursorModelSelectionId(model);
  },

  isAdaptiveReasoningModel(model: string): boolean {
    return isCursorModelSelectionId(model);
  },

  getReasoningOptions(model: string): ProviderReasoningOption[] {
    return isCursorModelSelectionId(model) ? getCursorReasoningOptions() : [];
  },

  getDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
    const rawId = normalizeDecodedRawModelId(model);
    if (!rawId) {
      return CURSOR_DEFAULT_REASONING_LEVEL;
    }

    const cursorSettings = getCursorProviderSettings(settings);
    return normalizeCursorReasoningLevel(
      cursorSettings.preferredEffortByModel[rawId]
        ?? CURSOR_DEFAULT_REASONING_LEVEL,
    );
  },

  getContextWindowSize(
    model: string,
    customLimits?: Record<string, number>,
    settings?: Record<string, unknown>,
  ): number {
    const rawId = normalizeDecodedRawModelId(model);
    const metadataContextWindow = rawId && settings
      ? getCursorProviderSettings(settings).discoveredModels
        .find(entry => entry.rawId === rawId)?.contextWindow
      : undefined;
    return metadataContextWindow ?? customLimits?.[model] ?? DEFAULT_CONTEXT_WINDOW;
  },

  isDefaultModel(model: string): boolean {
    return isCursorModelSelectionId(model);
  },

  applyModelDefaults(model: string, settings: unknown): void {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return;
    }

    const settingsBag = settings as Record<string, unknown>;
    const rawId = normalizeDecodedRawModelId(model);
    if (!rawId) {
      settingsBag.effortLevel = CURSOR_DEFAULT_REASONING_LEVEL;
      return;
    }

    settingsBag.model = encodeCursorModelId(rawId);
    settingsBag.effortLevel = getCursorDefaultReasoningValue(model, settingsBag);
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
      ...getCursorProviderSettings(settingsBag).preferredEffortByModel,
    };
    const normalized = normalizeCursorReasoningLevel(value);
    if (normalized === CURSOR_DEFAULT_REASONING_LEVEL) {
      delete nextPreferred[rawId];
    } else {
      nextPreferred[rawId] = normalized;
    }
    updateCursorProviderSettings(settingsBag, { preferredEffortByModel: nextPreferred });
  },

  normalizeModelVariant(model: string): string {
    const rawId = normalizeDecodedRawModelId(model);
    return rawId ? encodeCursorModelId(rawId) : model;
  },

  getCustomModelIds(): Set<string> {
    return new Set<string>();
  },

  getPermissionModeToggle(): ProviderPermissionModeToggleConfig {
    return CURSOR_PERMISSION_MODE_TOGGLE;
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
    return CURSOR_PROVIDER_ICON;
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
  const rawId = decodeCursorModelId(model);
  return rawId ? normalizeRawModelId(rawId) : null;
}

function getCursorDefaultReasoningValue(model: string, settings: Record<string, unknown>): string {
  return cursorChatUIConfig.getDefaultReasoningValue(model, settings);
}
