import { z } from 'zod';
import type { Enums } from '../../lib/database.types';

// Quick-plan types offered during onboarding (time-based plans only).
export const QUICK_PLAN_TYPES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export type QuickPlanType = (typeof QUICK_PLAN_TYPES)[number];

export const DURATION_MONTHS: Record<QuickPlanType, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

// zod is applied to the raw string form field, so amounts are coerced.
export const quickPlanSchema = z.object({
  name: z.string().trim().min(1, 'common.required').max(80),
  type: z.enum(QUICK_PLAN_TYPES),
  price_dzd: z.coerce
    .number({ invalid_type_error: 'errors.invalidAmount' })
    .int('errors.invalidAmount')
    .min(0, 'errors.invalidAmount'),
});

export type QuickPlanInput = z.infer<typeof quickPlanSchema>;

export function durationMonthsFor(type: Enums<'plan_type'>): number | null {
  return type in DURATION_MONTHS ? DURATION_MONTHS[type as QuickPlanType] : null;
}
