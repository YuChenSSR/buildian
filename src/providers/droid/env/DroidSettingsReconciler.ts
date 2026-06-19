import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import {
  decodeDroidModelId,
  DROID_PROVIDER_ID,
  encodeDroidModelId,
  isDroidModelSelectionId,
  normalizeRawModelId,
} from '../models';
import {
  getDroidProviderSettings,
  updateDroidProviderSettings,
} from '../settings';

const DROID_ENV_HASH_KEYS = [
  'DROID_CONFIG',
  'DROID_HOME',
  'DROID_MODEL_ID',
  'DROID_REASONING',
] as const;

function computeDroidEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return DROID_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const droidSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, DROID_PROVIDER_ID);
    const currentHash = computeDroidEnvHash(envText);
    const savedHash = getDroidProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations = conversations.filter((conversation) => (
      conversation.providerId === DROID_PROVIDER_ID && !!conversation.sessionId
    ));
    for (const conversation of invalidatedConversations) {
      conversation.sessionId = null;
      conversation.providerState = undefined;
    }

    updateDroidProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    let changed = false;

    const normalizeSelection = (value: unknown): string | null => {
      if (typeof value !== 'string' || !isDroidModelSelectionId(value)) {
        return null;
      }
      const rawModelId = decodeDroidModelId(value);
      return rawModelId ? encodeDroidModelId(normalizeRawModelId(rawModelId)) : value;
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
