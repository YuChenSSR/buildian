import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import {
  CURSOR_PROVIDER_ID,
  decodeCursorModelId,
  encodeCursorModelId,
  isCursorModelSelectionId,
  normalizeRawModelId,
} from '../models';
import {
  getCursorProviderSettings,
  updateCursorProviderSettings,
} from '../settings';

const CURSOR_ENV_HASH_KEYS = [
  'CURSOR_API_KEY',
  'CURSOR_HOME',
  'CURSOR_CONFIG',
] as const;

function computeCursorEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return CURSOR_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const cursorSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, CURSOR_PROVIDER_ID);
    const currentHash = computeCursorEnvHash(envText);
    const savedHash = getCursorProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations = conversations.filter((conversation) => (
      conversation.providerId === CURSOR_PROVIDER_ID && !!conversation.sessionId
    ));
    for (const conversation of invalidatedConversations) {
      conversation.sessionId = null;
      conversation.providerState = undefined;
    }

    updateCursorProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    let changed = false;

    const normalizeSelection = (value: unknown): string | null => {
      if (typeof value !== 'string' || !isCursorModelSelectionId(value)) {
        return null;
      }
      const rawModelId = decodeCursorModelId(value);
      return rawModelId ? encodeCursorModelId(normalizeRawModelId(rawModelId)) : value;
    };

    const normalizedModel = normalizeSelection(settings.model);
    if (typeof settings.model === 'string' && normalizedModel && settings.model !== normalizedModel) {
      settings.model = normalizedModel;
      changed = true;
    }

    const normalizedTitleModel = normalizeSelection(settings.titleGenerationModel);
    if (
      typeof settings.titleGenerationModel === 'string'
      && normalizedTitleModel
      && settings.titleGenerationModel !== normalizedTitleModel
    ) {
      settings.titleGenerationModel = normalizedTitleModel;
      changed = true;
    }

    return changed;
  },
};
