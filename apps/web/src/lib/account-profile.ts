import { z } from 'zod';

export const profileNameSchema = z
  .object({
    displayName: z
      .string()
      .trim()
      .min(2, 'Escribe al menos 2 caracteres.')
      .max(80, 'Usa 80 caracteres o menos.'),
  })
  .strict();

export const profilePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(1024),
    newPassword: z
      .string()
      .min(12, 'La nueva contraseña debe tener al menos 12 caracteres.')
      .max(1024),
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: 'Elige una contraseña distinta a la actual.',
    path: ['newPassword'],
  });

export type AccountProfile = {
  displayName: string;
  email: string;
  avatarVersion: number;
};

export type AccountAvatar = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: Uint8Array;
};

export const maximumAvatarBytes = 1024 * 1024;

/** Refuse active content and mismatched MIME, not just a file extension. */
export function validateAccountAvatar(bytes: Uint8Array, claimedMime: string): AccountAvatar {
  if (bytes.length < 16 || bytes.length > maximumAvatarBytes) throw new Error('AVATAR_INVALID');
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const jpeg =
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes.at(-2) === 0xff &&
    bytes.at(-1) === 0xd9;
  const webp =
    Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF' &&
    Buffer.from(bytes.subarray(8, 12)).toString() === 'WEBP';
  const mimeType = png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
  if (!mimeType || mimeType !== claimedMime) throw new Error('AVATAR_INVALID');
  return { mimeType, bytes };
}
