import { z } from 'zod';
import { mapIdentifierToEmail } from '../auth/identifier';

// Zod messages are i18n KEYS, rendered with t(error.message) (see login-form.tsx).
export const createGymSchema = z.object({
  name: z.string().trim().min(1, 'common.required').max(120),
  city: z.string().trim().max(80),
  default_language: z.enum(['ar', 'fr']),
  owner_full_name: z.string().trim().min(1, 'common.required').max(120),
  owner_phone_or_email: z
    .string()
    .trim()
    .min(1, 'common.required')
    .refine((value) => mapIdentifierToEmail(value) !== null, 'auth.invalidIdentifier'),
  password: z.string().min(8, 'errors.weakPassword'),
});

export type CreateGymInput = z.infer<typeof createGymSchema>;

export const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  new_password: z.string().min(8, 'errors.weakPassword'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#@$!';

/** Suggest a strong temporary password (design/02-admin-gyms/code-create.html). */
export function generateTempPassword(): string {
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += PASSWORD_ALPHABET[Math.floor(Math.random() * PASSWORD_ALPHABET.length)];
  }
  return `DZ-Fit#${suffix}`;
}
