import sharp from 'sharp';
import {
  maximumAvatarBytes,
  validateAccountAvatar,
  type AccountAvatar,
} from '@/lib/account-profile';

/** Decode, resize and strip EXIF before private storage. The original file is never persisted. */
export async function normalizeAccountAvatar(
  bytes: Uint8Array,
  claimedMime: string,
): Promise<AccountAvatar> {
  validateAccountAvatar(bytes, claimedMime);
  try {
    const normalized = await sharp(Buffer.from(bytes), {
      failOn: 'error',
      limitInputPixels: 16_000_000,
    })
      .rotate()
      .resize(320, 320, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 3 })
      .toBuffer();
    if (normalized.length < 16 || normalized.length > maximumAvatarBytes)
      throw new Error('AVATAR_INVALID');
    return { bytes: normalized, mimeType: 'image/webp' };
  } catch {
    throw new Error('AVATAR_INVALID');
  }
}
