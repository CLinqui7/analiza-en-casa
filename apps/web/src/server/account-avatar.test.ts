import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { normalizeAccountAvatar } from './account-avatar';

describe('private avatar normalization', () => {
  it('decodes a real image, strips original dimensions and stores a compact WebP', async () => {
    const original = await sharp({
      create: { width: 1200, height: 800, channels: 4, background: '#167480' },
    })
      .png()
      .toBuffer();
    const avatar = await normalizeAccountAvatar(original, 'image/png');
    const metadata = await sharp(avatar.bytes).metadata();
    expect(avatar.mimeType).toBe('image/webp');
    expect(metadata.width).toBeLessThanOrEqual(320);
    expect(metadata.height).toBeLessThanOrEqual(320);
    expect(metadata.exif).toBeUndefined();
    expect(avatar.bytes.length).toBeLessThan(original.length);
  });

  it('rejects a corrupt file even when its signature looks like PNG', async () => {
    const invalid = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    await expect(normalizeAccountAvatar(invalid, 'image/png')).rejects.toThrow('AVATAR_INVALID');
  });
});
