import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import type { ImageAttachment } from '../../../core/types';

export interface StagedAmpImages {
  paths: string[];
  cleanup: () => void;
}

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * The acp-amp adapter drops inline `image` content blocks, but the Amp CLI can
 * view image files referenced by path. Stage attachments as temp files so the
 * prompt can link them instead of embedding base64 data.
 */
export function stageAmpImageAttachments(
  images: ImageAttachment[] | undefined,
): StagedAmpImages | null {
  const attachments = (images ?? []).filter((image) => Boolean(image.data));
  if (attachments.length === 0) {
    return null;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claudian-amp-images-'));
  const paths: string[] = [];

  try {
    attachments.forEach((image, index) => {
      const filePath = path.join(tempDir, toStagedImageFilename(image, index));
      fs.writeFileSync(filePath, Buffer.from(image.data, 'base64'));
      paths.push(filePath);
    });
  } catch (error) {
    fs.rmSync(tempDir, { force: true, recursive: true });
    throw error;
  }

  return {
    cleanup: () => {
      try {
        fs.rmSync(tempDir, { force: true, recursive: true });
      } catch {
        // Best-effort temp file cleanup.
      }
    },
    paths,
  };
}

function toStagedImageFilename(image: ImageAttachment, index: number): string {
  const sanitized = path.basename((image.name ?? '').trim())
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '');
  const base = sanitized || `image-${index + 1}`;
  if (base.includes('.')) {
    return `${index + 1}-${base}`;
  }

  const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? 'png';
  return `${index + 1}-${base}.${extension}`;
}
