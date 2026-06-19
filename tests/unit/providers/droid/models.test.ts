import {
  DROID_DEFAULT_MODEL_ID,
  DROID_DEFAULT_REASONING_LEVEL,
  encodeDroidModelId,
  getDroidReasoningOptions,
  normalizeDroidReasoningLevel,
  resolveDroidCliModelId,
  shouldPassDroidModelToCli,
} from '@/providers/droid/models';

describe('Droid model helpers', () => {
  it('uses a provider-scoped default model without forcing a CLI model flag', () => {
    expect(DROID_DEFAULT_MODEL_ID).toBe('default');
    expect(encodeDroidModelId(DROID_DEFAULT_MODEL_ID)).toBe('droid:default');
    expect(resolveDroidCliModelId(DROID_DEFAULT_MODEL_ID)).toBeNull();
    expect(shouldPassDroidModelToCli(DROID_DEFAULT_MODEL_ID)).toBe(false);
  });

  it('passes explicit Droid model ids through to the CLI', () => {
    expect(resolveDroidCliModelId('gpt-5.3-codex')).toBe('gpt-5.3-codex');
    expect(resolveDroidCliModelId(' droid:claude-sonnet-4-6 ')).toBe('claude-sonnet-4-6');
    expect(shouldPassDroidModelToCli('claude-sonnet-4-6')).toBe(true);
  });

  it('normalizes Droid reasoning levels to the exec-supported set', () => {
    expect(DROID_DEFAULT_REASONING_LEVEL).toBe('low');
    expect(getDroidReasoningOptions().map(option => option.value)).toEqual([
      'off',
      'low',
      'medium',
      'high',
    ]);
    expect(normalizeDroidReasoningLevel(' HIGH ')).toBe('high');
    expect(normalizeDroidReasoningLevel('max')).toBe(DROID_DEFAULT_REASONING_LEVEL);
  });
});
