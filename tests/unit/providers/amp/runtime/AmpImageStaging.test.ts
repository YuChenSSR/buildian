import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ImageAttachment } from '@/core/types';
import { stageAmpImageAttachments } from '@/providers/amp/runtime/AmpImageStaging';

function createImage(overrides: Partial<ImageAttachment> = {}): ImageAttachment {
  return {
    id: 'img-1',
    name: 'screenshot.png',
    mediaType: 'image/png',
    data: Buffer.from('fake-png-bytes').toString('base64'),
    size: 14,
    source: 'paste',
    ...overrides,
  };
}

describe('stageAmpImageAttachments', () => {
  it('returns null when there are no attachments with data', () => {
    expect(stageAmpImageAttachments(undefined)).toBeNull();
    expect(stageAmpImageAttachments([])).toBeNull();
    expect(stageAmpImageAttachments([createImage({ data: '' })])).toBeNull();
  });

  it('writes attachments to temp files and removes them on cleanup', () => {
    const staged = stageAmpImageAttachments([
      createImage(),
      createImage({ id: 'img-2', name: 'photo', mediaType: 'image/jpeg', data: Buffer.from('jpeg').toString('base64') }),
    ]);

    expect(staged).not.toBeNull();
    expect(staged!.paths).toHaveLength(2);
    expect(path.isAbsolute(staged!.paths[0])).toBe(true);
    expect(staged!.paths[0].startsWith(os.tmpdir())).toBe(true);
    expect(staged!.paths[0].endsWith('.png')).toBe(true);
    expect(staged!.paths[1].endsWith('.jpg')).toBe(true);
    expect(fs.readFileSync(staged!.paths[0], 'utf8')).toBe('fake-png-bytes');
    expect(fs.readFileSync(staged!.paths[1], 'utf8')).toBe('jpeg');

    staged!.cleanup();
    expect(fs.existsSync(staged!.paths[0])).toBe(false);
    expect(fs.existsSync(staged!.paths[1])).toBe(false);
  });

  it('sanitizes unsafe attachment names', () => {
    const staged = stageAmpImageAttachments([
      createImage({ name: '../..//weird name!.png' }),
    ]);

    expect(staged).not.toBeNull();
    const filename = path.basename(staged!.paths[0]);
    expect(filename).not.toContain('/');
    expect(filename).not.toContain('..');
    expect(filename.endsWith('.png')).toBe(true);

    staged!.cleanup();
  });
});
