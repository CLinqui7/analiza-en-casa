import { describe, expect, it } from 'vitest';
import {
  maximumAvatarBytes,
  profileNameSchema,
  profilePasswordSchema,
  validateAccountAvatar,
} from './account-profile';

describe('Personal account profile input', () => {
  it('accepts a bounded name and refuses authority fields', () => {
    expect(profileNameSchema.parse({ displayName: '  Claudia P.  ' })).toEqual({
      displayName: 'Claudia P.',
    });
    expect(profileNameSchema.safeParse({ displayName: 'A' }).success).toBe(false);
    expect(profileNameSchema.safeParse({ displayName: 'Ana', role: 'ADMIN' }).success).toBe(false);
  });

  it('requires current password and a different 12+ character replacement', () => {
    expect(
      profilePasswordSchema.safeParse({
        currentPassword: 'old-password',
        newPassword: 'new-password-123',
      }).success,
    ).toBe(true);
    expect(
      profilePasswordSchema.safeParse({ currentPassword: '', newPassword: 'new-password-123' })
        .success,
    ).toBe(false);
    expect(
      profilePasswordSchema.safeParse({
        currentPassword: 'same-password',
        newPassword: 'same-password',
      }).success,
    ).toBe(false);
    expect(
      profilePasswordSchema.safeParse({ currentPassword: 'old-password', newPassword: 'short' })
        .success,
    ).toBe(false);
  });

  it('accepts only matching, bounded image signatures', () => {
    const png = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(validateAccountAvatar(png, 'image/png').mimeType).toBe('image/png');
    expect(() => validateAccountAvatar(png, 'image/jpeg')).toThrow('AVATAR_INVALID');
    expect(() =>
      validateAccountAvatar(new Uint8Array(maximumAvatarBytes + 1), 'image/png'),
    ).toThrow('AVATAR_INVALID');
    expect(() =>
      validateAccountAvatar(
        new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
        'image/svg+xml',
      ),
    ).toThrow('AVATAR_INVALID');
  });
});
