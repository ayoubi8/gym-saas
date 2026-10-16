import { z } from 'zod';
import { isValidDzPhone } from '../../lib/phone';
import type { Enums } from '../../lib/database.types';

export const LANGUAGES = ['ar', 'fr'] as const satisfies readonly Enums<'lang'>[];

// Phone is validated client-side (raw formats accepted) and normalized again
// server-side by create_member / update_member (DATA-CONTRACT.md row 08).
export const memberSchema = z.object({
  full_name: z.string().trim().min(1, 'common.required').max(120),
  phone: z
    .string()
    .trim()
    .min(1, 'common.required')
    .refine(isValidDzPhone, 'members.invalidPhone'),
  language: z.enum(LANGUAGES).optional(),
});

export type MemberInput = z.infer<typeof memberSchema>;
