import { z } from 'zod';

export const registrationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(12).max(128),
  })
  .strict();

export type RegistrationInput = z.infer<typeof registrationSchema>;

/**
 * Server-backed registration stays opt-in. The public demo is the one exception:
 * it creates an isolated browser-only account and never calls a persistence API.
 */
export function isRegistrationEnabled() {
  const mode = process.env.NEXT_PUBLIC_REGISTRATION_MODE;
  if (mode === 'disabled') return false;
  if (mode === 'isolated') return true;
  return (
    process.env.NEXT_PUBLIC_DATA_MODE === 'mock' &&
    process.env.NEXT_PUBLIC_RELEASE_PROFILE === 'demo'
  );
}
