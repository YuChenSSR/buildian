import {
  AMP_MODEL_ID,
  ampModeFromModelId,
  ampModelIdForMode,
  ampModeSupportsEffort,
  buildAmpModelOptions,
  getAmpDefaultEffort,
  getAmpReasoningOptions,
  isAmpModelSelectionId,
  normalizeAmpEffort,
  normalizeAmpModelId,
  resolveAmpAgentMode,
} from '@/providers/amp/models';

describe('Amp model helpers', () => {
  it('exposes Amp agent modes as selectable models', () => {
    expect(AMP_MODEL_ID).toBe('amp');
    expect(buildAmpModelOptions()).toEqual([
      { description: 'Balanced default mode', label: 'Amp Smart', value: 'amp' },
      {
        description: 'Deepest reasoning (experimental — enable "deep" in Amp settings)',
        label: 'Amp Deep',
        value: 'amp:deep',
      },
      { description: 'Fastest, minimal reasoning', label: 'Amp Rush', value: 'amp:rush' },
    ]);
  });

  it('maps modes to ids and back', () => {
    expect(ampModelIdForMode('smart')).toBe('amp');
    expect(ampModelIdForMode('deep')).toBe('amp:deep');
    expect(ampModelIdForMode('rush')).toBe('amp:rush');

    expect(ampModeFromModelId('amp')).toBe('smart');
    expect(ampModeFromModelId('amp:smart')).toBe('smart');
    expect(ampModeFromModelId('amp:deep')).toBe('deep');
    expect(ampModeFromModelId('amp:rush')).toBe('rush');
    expect(ampModeFromModelId('grok:grok-build')).toBeNull();
    expect(resolveAmpAgentMode('grok:grok-build')).toBe('smart');
  });

  it('normalizes legacy and mode-scoped Amp model ids', () => {
    expect(normalizeAmpModelId('')).toBe('amp');
    expect(normalizeAmpModelId('amp')).toBe('amp');
    expect(normalizeAmpModelId('amp:default')).toBe('amp');
    expect(normalizeAmpModelId('amp:amp')).toBe('amp');
    expect(normalizeAmpModelId('amp:smart')).toBe('amp');
    expect(normalizeAmpModelId('amp:deep')).toBe('amp:deep');
    expect(normalizeAmpModelId('amp:rush')).toBe('amp:rush');

    expect(isAmpModelSelectionId('amp')).toBe(true);
    expect(isAmpModelSelectionId('amp:deep')).toBe(true);
    expect(isAmpModelSelectionId('amp:default')).toBe(true);
    expect(isAmpModelSelectionId('grok:grok-build')).toBe(false);
  });

  it('derives reasoning effort options per mode', () => {
    expect(ampModeSupportsEffort('smart')).toBe(true);
    expect(ampModeSupportsEffort('deep')).toBe(true);
    expect(ampModeSupportsEffort('rush')).toBe(false);

    expect(getAmpReasoningOptions('amp').map(option => option.value)).toEqual([
      'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max',
    ]);
    expect(getAmpReasoningOptions('amp:rush')).toEqual([]);

    expect(getAmpDefaultEffort('amp')).toBe('medium');
    expect(getAmpDefaultEffort('amp:deep')).toBe('high');
    expect(getAmpDefaultEffort('amp:rush')).toBe('');
  });

  it('clamps effort selections to the active mode', () => {
    expect(normalizeAmpEffort('amp', 'xhigh')).toBe('xhigh');
    expect(normalizeAmpEffort('amp', 'bogus')).toBe('medium');
    expect(normalizeAmpEffort('amp:deep', 'low')).toBe('low');
    expect(normalizeAmpEffort('amp:rush', 'high')).toBe('');
  });
});
