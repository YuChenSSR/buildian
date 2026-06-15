import type { Conversation } from '@/core/types';
import { CursorConversationHistoryService } from '@/providers/cursor/history/CursorConversationHistoryService';

describe('CursorConversationHistoryService', () => {
  it('persists local messages because Cursor ACP transcripts are not hydrated yet', () => {
    const service = new CursorConversationHistoryService();
    const conversation = {
      createdAt: 1,
      id: 'cursor-session',
      messages: [
        {
          content: 'old question',
          id: 'm1',
          role: 'user',
          timestamp: 1,
        },
      ],
      providerId: 'cursor-agent',
      sessionId: 'cursor-session',
      title: 'Cursor session',
      updatedAt: 2,
    } satisfies Conversation;

    expect(service.buildPersistedMessages(conversation)).toEqual(conversation.messages);
  });
});
