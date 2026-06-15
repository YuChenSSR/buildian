import { buildCursorPromptText, prependCursorSystemInstructions } from '@/providers/cursor/runtime/buildCursorPrompt';

describe('buildCursorPromptText', () => {
  it('prepends custom system instructions as a high-priority block', () => {
    const prompt = buildCursorPromptText(
      { text: '解释一下这个例子' },
      [],
      '注意行内公式用 $ $，行间公式用 $$ $$',
    );

    expect(prompt).toContain('<system_instructions priority="high">');
    expect(prompt).toContain('注意行内公式用 $ $，行间公式用 $$ $$');
    expect(prompt.trim().endsWith('解释一下这个例子')).toBe(true);
  });

  it('does not change prompts when no custom system instruction exists', () => {
    expect(prependCursorSystemInstructions('hello', '   ')).toBe('hello');
  });
});
