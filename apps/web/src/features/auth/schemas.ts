import { z } from 'zod';
import { mapIdentifierToEmail } from './identifier';

// Zod messages are i18n KEYS, rendered with t(error.message) in the form.
export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'auth.required')
    .refine((value) => mapIdentifierToEmail(value) !== null, 'auth.invalidIdentifier'),
  password: z.string().min(1, 'auth.required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
