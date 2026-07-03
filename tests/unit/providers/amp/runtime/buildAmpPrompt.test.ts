import { buildAmpPromptBlocks, buildAmpPromptText, prependAmpSystemInstructions } from '@/providers/amp/runtime/buildAmpPrompt';

describe('buildAmpPromptText', () => {
  it('prepends custom system instructions as a high-priority block', () => {
    const prompt = buildAmpPromptText(
      { text: '解释一下这个例子' },
      [],
      '注意行内公式用 $ $，行间公式用 $$ $$',
    );

    expect(prompt).toContain('<system_instructions priority="high">');
    expect(prompt).toContain('注意行内公式用 $ $，行间公式用 $$ $$');
    expect(prompt.trim().endsWith('解释一下这个例子')).toBe(true);
  });

  it('does not change prompts when no custom system instruction exists', () => {
    expect(prependAmpSystemInstructions('hello', '   ')).toBe('hello');
  });
});

describe('buildAmpPromptBlocks', () => {
  it('returns a single text block when no image files are staged', () => {
    const blocks = buildAmpPromptBlocks({ text: 'hello' });

    expect(blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('links staged image files as resource_link blocks with a viewing note', () => {
    const blocks = buildAmpPromptBlocks(
      { text: 'what color is this?' },
      [],
      '',
      ['/tmp/claudian-amp-images-abc/1-shot.png', '/tmp/claudian-amp-images-abc/2-photo.jpg'],
    );

    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe('text');
    const text = (blocks[0] as { text: string }).text;
    expect(text).toContain('what color is this?');
    expect(text).toContain('attached the image files');
    expect(blocks[1]).toEqual({
      name: '1-shot.png',
      type: 'resource_link',
      uri: '/tmp/claudian-amp-images-abc/1-shot.png',
    });
    expect(blocks[2]).toEqual({
      name: '2-photo.jpg',
      type: 'resource_link',
      uri: '/tmp/claudian-amp-images-abc/2-photo.jpg',
    });
  });
});
