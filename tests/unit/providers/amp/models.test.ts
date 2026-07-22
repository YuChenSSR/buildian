import {
  AMP_MODEL_ID,
  ampModeFromModelId,
  ampModelIdForMode,
  buildAmpModelOptions,
  isAmpModelSelectionId,
  normalizeAmpModelId,
  resolveAmpAgentMode,
} from '@/providers/amp/models';

describe('Amp model helpers', () => {
  it('exposes Amp agent modes as selectable models', () => {
    expect(AMP_MODEL_ID).toBe('amp');
    expect(buildAmpModelOptions()).toEqual([
      {
        description: 'Balanced intelligence, speed, and cost for most tasks',
        label: 'Amp Medium',
        value: 'amp',
      },
      {
        description: 'Fast, low-cost mode for small, well-defined tasks',
        label: 'Amp Low',
        value: 'amp:low',
      },
      {
        description: 'Deep reasoning for hard tasks',
        label: 'Amp High',
        value: 'amp:high',
      },
      {
        description: 'Most capable mode for hard, open-ended tasks',
        label: 'Amp Ultra',
        value: 'amp:ultra',
      },
    ]);
  });

  it('maps modes to ids and back', () => {
    expect(ampModelIdForMode('medium')).toBe('amp');
    expect(ampModelIdForMode('low')).toBe('amp:low');
    expect(ampModelIdForMode('high')).toBe('amp:high');
    expect(ampModelIdForMode('ultra')).toBe('amp:ultra');

    expect(ampModeFromModelId('amp')).toBe('medium');
    expect(ampModeFromModelId('amp:medium')).toBe('medium');
    expect(ampModeFromModelId('amp:low')).toBe('low');
    expect(ampModeFromModelId('amp:high')).toBe('high');
    expect(ampModeFromModelId('amp:ultra')).toBe('ultra');
    expect(ampModeFromModelId('grok:grok-build')).toBeNull();
    expect(resolveAmpAgentMode('grok:grok-build')).toBe('medium');
  });

  it('normalizes current mode-scoped Amp model ids', () => {
    expect(normalizeAmpModelId('')).toBe('amp');
    expect(normalizeAmpModelId('amp')).toBe('amp');
    expect(normalizeAmpModelId('amp:default')).toBe('amp');
    expect(normalizeAmpModelId('amp:amp')).toBe('amp');
    expect(normalizeAmpModelId('amp:medium')).toBe('amp');
    expect(normalizeAmpModelId('amp:low')).toBe('amp:low');
    expect(normalizeAmpModelId('amp:high')).toBe('amp:high');
    expect(normalizeAmpModelId('amp:ultra')).toBe('amp:ultra');

    expect(isAmpModelSelectionId('amp')).toBe(true);
    expect(isAmpModelSelectionId('amp:high')).toBe(true);
    expect(isAmpModelSelectionId('amp:default')).toBe(true);
    expect(isAmpModelSelectionId('amp:smart')).toBe(false);
    expect(isAmpModelSelectionId('amp:deep')).toBe(false);
    expect(isAmpModelSelectionId('amp:rush')).toBe(false);
    expect(isAmpModelSelectionId('amp:large')).toBe(false);
    expect(isAmpModelSelectionId('grok:grok-build')).toBe(false);
  });
});
