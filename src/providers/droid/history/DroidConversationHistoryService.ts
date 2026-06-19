import type { ProviderConversationHistoryService } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { type DroidProviderState, getDroidState } from '../types';

export class DroidConversationHistoryService implements ProviderConversationHistoryService {
  async hydrateConversationHistory(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // Droid ACP can load saved sessions by id, but the CLI transcript export format is
    // not consumed here yet. Existing in-memory messages are left untouched.
  }

  async deleteConversationSession(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // Never mutate Droid native history.
  }

  resolveSessionIdForConversation(conversation: Conversation | null): string | null {
    return conversation?.sessionId ?? null;
  }

  isPendingForkConversation(_conversation: Conversation): boolean {
    return false;
  }

  buildForkProviderState(
    _sourceSessionId: string,
    _resumeAt: string,
    _sourceProviderState?: Record<string, unknown>,
  ): Record<string, unknown> {
    return {};
  }

  buildPersistedProviderState(
    conversation: Conversation,
  ): Record<string, unknown> | undefined {
    const state = getDroidState(conversation.providerState);
    const providerState: DroidProviderState = {
      ...(state.agentVersion ? { agentVersion: state.agentVersion } : {}),
      ...(state.sessionConfigKey ? { sessionConfigKey: state.sessionConfigKey } : {}),
    };

    return Object.keys(providerState).length > 0
      ? providerState as Record<string, unknown>
      : undefined;
  }

  buildPersistedMessages(conversation: Conversation): Conversation['messages'] | undefined {
    return conversation.messages.length > 0 ? conversation.messages : undefined;
  }
}
