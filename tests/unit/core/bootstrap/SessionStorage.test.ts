import { SessionStorage } from '@/core/bootstrap/SessionStorage';
import { ProviderRegistry } from '@/core/providers/ProviderRegistry';
import type { ProviderConversationHistoryService } from '@/core/providers/types';
import type { Conversation } from '@/core/types';

describe('SessionStorage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes provider-local messages when the history service requests it', () => {
    jest.spyOn(ProviderRegistry, 'getConversationHistoryService').mockReturnValue({
      buildForkProviderState: jest.fn(),
      buildPersistedMessages: conversation => conversation.messages,
      deleteConversationSession: jest.fn(),
      hydrateConversationHistory: jest.fn(),
      isPendingForkConversation: jest.fn(() => false),
      resolveSessionIdForConversation: jest.fn(() => null),
    } satisfies ProviderConversationHistoryService);

    const storage = new SessionStorage({} as never);
    const conversation = {
      createdAt: 1,
      id: 'conv-local',
      messages: [
        {
          content: 'hello',
          id: 'm1',
          role: 'user',
          timestamp: 1,
        },
      ],
      providerId: 'cursor-agent',
      sessionId: 'session-1',
      title: 'Local',
      updatedAt: 2,
    } satisfies Conversation;

    expect(storage.toSessionMetadata(conversation).messages).toEqual(conversation.messages);
  });
});
