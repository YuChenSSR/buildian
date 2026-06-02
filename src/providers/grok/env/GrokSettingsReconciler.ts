import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import {
  decodeGrokModelId,
  encodeGrokModelId,
  isGrokModelSelectionId,
} from '../models';
import {
  getGrokProviderSettings,
  updateGrokProviderSettings,
} from '../settings';

const GROK_ENV_HASH_KEYS = [
  'GROK_HOME',
  'GROK_CONFIG',
  'GROK_CODE_XAI_API_KEY',
  'XAI_API_KEY',
] as const;

function computeGrokEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return GROK_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const grokSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, 'grok');
    const currentHash = computeGrokEnvHash(envText);
    const savedHash = getGrokProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations = conversations.filter((conversation) => (
      conversation.providerId === 'grok' && !!conversation.sessionId
    ));
    for (const conversation of invalidatedConversations) {
      conversation.sessionId = null;
      conversation.providerState = undefined;
    }

    updateGrokProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    let changed = false;

    const normalizeSelection = (value: unknown): string | null => {
      if (typeof value !== 'string' || !isGrokModelSelectionId(value)) {
        return null;
      }
      const rawModelId = decodeGrokModelId(value);
      return rawModelId ? encodeGrokModelId(rawModelId) : value;
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
