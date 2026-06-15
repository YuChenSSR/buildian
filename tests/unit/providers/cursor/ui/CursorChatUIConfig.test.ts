import { encodeCursorModelId } from '@/providers/cursor/models';
import { cursorChatUIConfig } from '@/providers/cursor/ui/CursorChatUIConfig';

describe('cursorChatUIConfig reasoning controls', () => {
  it('treats Cursor Agent models as adaptive effort models', () => {
    expect(cursorChatUIConfig.isAdaptiveReasoningModel(
      encodeCursorModelId('claude-opus-4-6[context=200k,effort=max]'),
      {},
    )).toBe(true);
    expect(cursorChatUIConfig.getReasoningOptions(
      encodeCursorModelId('default[]'),
      {},
    ).map(option => option.value)).toContain('max');
  });

  it('uses max effort by default even when ACP raw model ids contain high', () => {
    expect(cursorChatUIConfig.getDefaultReasoningValue(
      encodeCursorModelId('claude-opus-4-6[context=200k,effort=high]'),
      {},
    )).toBe('max');
  });

  it('persists an explicit non-default effort selection for the selected model', () => {
    const settings: Record<string, unknown> = {
      providerConfigs: {
        'cursor-agent': {
          discoveredModels: [
            {
              label: 'Claude Opus',
              rawId: 'claude-opus-4-6[context=200k,effort=high]',
            },
          ],
          visibleModels: ['claude-opus-4-6[context=200k,effort=high]'],
        },
      },
    };

    cursorChatUIConfig.applyReasoningSelection?.(
      encodeCursorModelId('claude-opus-4-6[context=200k,effort=high]'),
      'high',
      settings,
    );

    expect(settings.providerConfigs).toMatchObject({
      'cursor-agent': {
        preferredEffortByModel: {
          'claude-opus-4-6[context=200k,effort=high]': 'high',
        },
      },
    });
  });
});
