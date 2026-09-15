import { z } from 'zod';

export const registrationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    password: z.string().min(12).max(128),
  })
  .strict();

export type RegistrationInput = z.infer<typeof registrationSchema>;

/** Registration must be explicitly enabled for a deployment with a supported backend. */
export function isRegistrationEnabled() {
  return process.env.NEXT_PUBLIC_REGISTRATION_MODE === 'isolated';
}
