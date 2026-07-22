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

  it('exposes only the effort levels supported by current GPT model families', () => {
    expect(getCursorReasoningOptions(
      'gpt-5.6-sol[context=272k,reasoning=medium,fast=false]',
    ).map(option => option.value)).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'xhigh',
      'max',
    ]);
    expect(getCursorReasoningOptions(
      'gpt-5.5[context=272k,reasoning=medium,fast=false]',
    ).map(option => option.value)).toEqual([
      'none',
      'low',
      'medium',
      'high',
      'extra-high',
    ]);
    expect(getCursorReasoningOptions(
      'gpt-5.3-codex[reasoning=medium,fast=false]',
    ).map(option => option.value)).toEqual([
      'low',
      'medium',
      'high',
      'xhigh',
    ]);
  });

  it('uses Grok-specific efforts and hides reasoning controls for Kimi', () => {
    expect(getCursorReasoningOptions(
      'grok-4.5[effort=high,fast=true]',
    ).map(option => option.value)).toEqual(['low', 'medium', 'high']);
    expect(getCursorReasoningOptions('kimi-k2.7-code[]')).toEqual([]);
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

  it('maps current GPT ACP ids to valid Cursor CLI ids', () => {
    expect(resolveCursorCliModelId(
      'gpt-5.6-sol[context=272k,reasoning=medium,fast=false]',
      'max',
    )).toBe('gpt-5.6-sol-max');
    expect(resolveCursorCliModelId(
      'gpt-5.5[context=272k,reasoning=medium,fast=true]',
      'max',
    )).toBe('gpt-5.5-extra-high-fast');
    expect(resolveCursorCliModelId(
      'gpt-5.3-codex[reasoning=medium,fast=false]',
      'medium',
    )).toBe('gpt-5.3-codex');
    expect(resolveCursorCliModelId(
      'gpt-5.2[reasoning=medium,fast=false]',
      'medium',
    )).toBe('gpt-5.2');
    expect(resolveCursorCliModelId(
      'gpt-5.6-terra[context=272k,reasoning=medium,fast=false]',
      'max',
    )).toBe('gpt-5.6-terra-max');
    expect(resolveCursorCliModelId(
      'gpt-5.6-luna[context=272k,reasoning=medium,fast=false]',
      'max',
    )).toBe('gpt-5.6-luna-max');
    expect(resolveCursorCliModelId(
      'gpt-5.4[context=272k,reasoning=medium,fast=false]',
      'max',
    )).toBe('gpt-5.4-xhigh');
    expect(resolveCursorCliModelId('gpt-5.4-mini[reasoning=medium]', 'max'))
      .toBe('gpt-5.4-mini-xhigh');
    expect(resolveCursorCliModelId('gpt-5.4-nano[reasoning=medium]', 'max'))
      .toBe('gpt-5.4-nano-xhigh');
    expect(resolveCursorCliModelId('gpt-5.1[reasoning=medium]', 'max'))
      .toBe('gpt-5.1-high');
    expect(resolveCursorCliModelId('gpt-5-mini[]', 'max')).toBe('gpt-5-mini');
  });

  it('maps current Grok and Kimi ACP ids to valid Cursor CLI ids', () => {
    expect(resolveCursorCliModelId(
      'grok-4.5[effort=high,fast=true]',
      'max',
    )).toBe('cursor-grok-4.5-high-fast');
    expect(resolveCursorCliModelId('kimi-k2.7-code[]', 'max')).toBe('kimi-k2.7-code');
  });

  it('passes only public Cursor model ids to the CLI', () => {
    expect(shouldPassCursorModelToCli('claude-4.6-opus-max-thinking')).toBe(true);
    expect(shouldPassCursorModelToCli('default[]')).toBe(false);
    expect(shouldPassCursorModelToCli('claude-opus-4-6[context=200k,effort=max]')).toBe(false);
  });
});
