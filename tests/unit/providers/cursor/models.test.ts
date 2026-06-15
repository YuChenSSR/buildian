import {
  applyCursorReasoningLevel,
  CURSOR_DEFAULT_REASONING_LEVEL,
  extractCursorReasoningLevel,
  getCursorReasoningOptions,
  normalizeCursorReasoningLevel,
  resolveCursorCliModelId,
  shouldPassCursorModelToCli,
} from '@/providers/cursor/models';

describe('Cursor model reasoning helpers', () => {
  it('normalizes Cursor effort values', () => {
    expect(normalizeCursorReasoningLevel(' max ')).toBe('max');
    expect(normalizeCursorReasoningLevel('XHIGH')).toBe('xhigh');
    expect(normalizeCursorReasoningLevel('not-real')).toBe(CURSOR_DEFAULT_REASONING_LEVEL);
  });

  it('exposes effort options for Cursor Agent models', () => {
    expect(getCursorReasoningOptions().map(option => option.value)).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'extra-high',
      'max',
    ]);
  });

  it('extracts effort from ACP bracket model ids', () => {
    expect(extractCursorReasoningLevel(
      'claude-opus-4-6[thinking=true,context=200k,effort=max,fast=false]',
    )).toBe('max');
    expect(extractCursorReasoningLevel(
      'gpt-5.5[context=400k,reasoning=medium]',
    )).toBe('medium');
    expect(extractCursorReasoningLevel('claude-4.6-opus-high-thinking')).toBe('high');
  });

  it('applies effort to ACP bracket model ids without changing other parameters', () => {
    expect(applyCursorReasoningLevel(
      'claude-opus-4-6[thinking=true,context=200k,effort=high,fast=false]',
      'max',
    )).toBe('claude-opus-4-6[thinking=true,context=200k,effort=max,fast=false]');
    expect(applyCursorReasoningLevel(
      'gpt-5.5[context=400k,reasoning=medium]',
      'low',
    )).toBe('gpt-5.5[context=400k,reasoning=low]');
    expect(applyCursorReasoningLevel('default[]', 'max')).toBe('claude-4.6-opus-max-thinking');
  });

  it('maps ACP Opus 4.6 thinking models to Cursor CLI public ids', () => {
    expect(resolveCursorCliModelId(
      'claude-opus-4-6[thinking=true,context=200k,effort=high,fast=false]',
      'max',
    )).toBe('claude-4.6-opus-max-thinking');
    expect(resolveCursorCliModelId(
      'claude-opus-4-6[thinking=true,context=200k,effort=high,fast=true]',
      'max',
    )).toBe('claude-4.6-opus-max-thinking-fast');
  });

  it('passes only public Cursor model ids to the CLI', () => {
    expect(shouldPassCursorModelToCli('claude-4.6-opus-max-thinking')).toBe(true);
    expect(shouldPassCursorModelToCli('default[]')).toBe(false);
    expect(shouldPassCursorModelToCli('claude-opus-4-6[context=200k,effort=max]')).toBe(false);
  });
});
