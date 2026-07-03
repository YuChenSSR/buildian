import type { ImageAttachment } from '@/core/types';
import { buildGrokPromptBlocks } from '@/providers/grok/runtime/buildGrokPrompt';

function createImage(overrides: Partial<ImageAttachment> = {}): ImageAttachment {
  return {
    id: 'img-1',
    name: 'screenshot.png',
    mediaType: 'image/png',
    data: 'aGVsbG8=',
    size: 5,
    source: 'paste',
    ...overrides,
  };
}

describe('buildGrokPromptBlocks', () => {
  it('returns a single text block when no images are attached', () => {
    const blocks = buildGrokPromptBlocks({ text: 'hello' });

    expect(blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });

  it('appends attached images as ACP image blocks', () => {
    const blocks = buildGrokPromptBlocks({
      text: 'what color is this?',
      images: [
        createImage(),
        createImage({ id: 'img-2', name: 'photo.jpg', mediaType: 'image/jpeg', data: 'd29ybGQ=' }),
      ],
    });

    expect(blocks).toEqual([
      { type: 'text', text: 'what color is this?' },
      { type: 'image', data: 'aGVsbG8=', mimeType: 'image/png' },
      { type: 'image', data: 'd29ybGQ=', mimeType: 'image/jpeg' },
    ]);
  });

  it('skips image attachments without data', () => {
    const blocks = buildGrokPromptBlocks({
      text: 'hello',
      images: [createImage({ data: '' })],
    });

    expect(blocks).toEqual([{ type: 'text', text: 'hello' }]);
  });
});
