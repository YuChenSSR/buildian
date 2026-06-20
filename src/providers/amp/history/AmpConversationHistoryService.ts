import type { ProviderConversationHistoryService } from '../../../core/providers/types';
import type { Conversation } from '../../../core/types';
import { type AmpProviderState, getAmpState } from '../types';

export class AmpConversationHistoryService implements ProviderConversationHistoryService {
  async hydrateConversationHistory(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // acp-amp currently does not expose durable ACP session loading. Claudian keeps
    // local messages and bootstraps a fresh adapter session after restart.
  }

  async deleteConversationSession(
    _conversation: Conversation,
    _vaultPath: string | null,
  ): Promise<void> {
    // Never mutate Amp native thread history from Claudian.
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
    const state = getAmpState(conversation.providerState);
    const providerState: AmpProviderState = {
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
