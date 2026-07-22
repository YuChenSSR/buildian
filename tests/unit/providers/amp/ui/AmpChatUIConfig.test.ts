import { ampChatUIConfig } from '@/providers/amp/ui/AmpChatUIConfig';

describe('ampChatUIConfig', () => {
  it('treats capability as part of the mode instead of a separate effort control', () => {
    expect(ampChatUIConfig.isAdaptiveReasoningModel('amp:ultra', {})).toBe(false);
    expect(ampChatUIConfig.getReasoningOptions('amp:ultra', {})).toEqual([]);
    expect(ampChatUIConfig.getDefaultReasoningValue('amp:ultra', {})).toBe('');
  });

  it('clears stale effort when applying an Amp mode', () => {
    const settings: Record<string, unknown> = {
      effortLevel: 'max',
      model: 'amp',
    };

    ampChatUIConfig.applyModelDefaults('amp:high', settings);

    expect(settings).toMatchObject({
      effortLevel: '',
      model: 'amp:high',
    });
  });
});
