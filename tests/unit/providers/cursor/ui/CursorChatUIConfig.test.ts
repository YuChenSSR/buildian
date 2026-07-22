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

  it('uses model-specific defaults for GPT and Grok', () => {
    expect(cursorChatUIConfig.getDefaultReasoningValue(
      encodeCursorModelId('gpt-5.5[context=272k,reasoning=medium,fast=false]'),
      {},
    )).toBe('extra-high');
    expect(cursorChatUIConfig.getDefaultReasoningValue(
      encodeCursorModelId('grok-4.5[effort=high,fast=true]'),
      {},
    )).toBe('high');
  });

  it('does not expose adaptive reasoning controls for Kimi', () => {
    const model = encodeCursorModelId('kimi-k2.7-code[]');

    expect(cursorChatUIConfig.isAdaptiveReasoningModel(model, {})).toBe(false);
    expect(cursorChatUIConfig.getReasoningOptions(model, {})).toEqual([]);
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
