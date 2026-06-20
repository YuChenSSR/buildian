import { getRuntimeEnvironmentText } from '../../../core/providers/providerEnvironment';
import type { ProviderSettingsReconciler } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { parseEnvironmentVariables } from '../../../utils/env';
import {
  AMP_MODEL_ID,
  AMP_PROVIDER_ID,
  isAmpModelSelectionId,
  normalizeAmpModelId,
} from '../models';
import {
  getAmpProviderSettings,
  updateAmpProviderSettings,
} from '../settings';

const AMP_ENV_HASH_KEYS = [
  'ACP_AMP_DRIVER',
  'ACP_AMP_NODE',
  'ACP_AMP_SHIM',
  'AMP_API_KEY',
  'AMP_SETTINGS',
] as const;

function computeAmpEnvHash(envText: string): string {
  const envVars = parseEnvironmentVariables(envText || '');
  return AMP_ENV_HASH_KEYS
    .filter((key) => envVars[key])
    .map((key) => `${key}=${envVars[key]}`)
    .sort()
    .join('|');
}

export const ampSettingsReconciler: ProviderSettingsReconciler = {
  reconcileModelWithEnvironment(
    settings: Record<string, unknown>,
    conversations: Conversation[],
  ): { changed: boolean; invalidatedConversations: Conversation[] } {
    const envText = getRuntimeEnvironmentText(settings, AMP_PROVIDER_ID);
    const currentHash = computeAmpEnvHash(envText);
    const savedHash = getAmpProviderSettings(settings).environmentHash;

    if (currentHash === savedHash) {
      return { changed: false, invalidatedConversations: [] };
    }

    const invalidatedConversations = conversations.filter((conversation) => (
      conversation.providerId === AMP_PROVIDER_ID && !!conversation.sessionId
    ));
    for (const conversation of invalidatedConversations) {
      conversation.sessionId = null;
      conversation.providerState = undefined;
    }

    updateAmpProviderSettings(settings, { environmentHash: currentHash });
    return { changed: true, invalidatedConversations };
  },

  normalizeModelVariantSettings(settings: Record<string, unknown>): boolean {
    let changed = false;

    if (typeof settings.model === 'string' && isAmpModelSelectionId(settings.model)) {
      const normalizedModel = normalizeAmpModelId(settings.model);
      if (normalizedModel !== settings.model) {
        settings.model = normalizedModel;
        changed = true;
      }
    }

    if (
      typeof settings.titleGenerationModel === 'string'
      && isAmpModelSelectionId(settings.titleGenerationModel)
      && settings.titleGenerationModel !== AMP_MODEL_ID
    ) {
      settings.titleGenerationModel = AMP_MODEL_ID;
      changed = true;
    }

    return changed;
  },
};
