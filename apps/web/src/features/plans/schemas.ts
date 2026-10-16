import { z } from 'zod';
import type { Enums } from '../../lib/database.types';

// Plan types (DATA-CONTRACT.md row 04). Time plans derive their length from the
// type; session plans carry a session count + optional validity window.
export const TIME_PLAN_TYPES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const;
export const SESSION_PLAN_TYPES = ['per_session', 'class_pack'] as const;

export const PLAN_TYPES = [
  ...TIME_PLAN_TYPES,
  ...SESSION_PLAN_TYPES,
] as const satisfies readonly Enums<'plan_type'>[];

export type PlanType = Enums<'plan_type'>;

export function isTimePlan(type: PlanType): boolean {
  return (TIME_PLAN_TYPES as readonly string[]).includes(type);
}

const optionalPositiveInt = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce
    .number({ invalid_type_error: 'errors.invalidAmount' })
    .int('errors.invalidAmount')
    .positive('errors.invalidAmount')
    .optional(),
);

export const planSchema = z
  .object({
    name: z.string().trim().min(1, 'common.required').max(80),
    type: z.enum(PLAN_TYPES),
    price_dzd: z.coerce
      .number({ invalid_type_error: 'errors.invalidAmount' })
      .int('errors.invalidAmount')
      .min(0, 'errors.invalidAmount'),
    session_count: optionalPositiveInt,
    validity_days: optionalPositiveInt,
  })
  .superRefine((value, ctx) => {
    if (!isTimePlan(value.type) && value.session_count === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['session_count'],
        message: 'common.required',
      });
    }
  });

export type PlanInput = z.infer<typeof planSchema>;

const DURATION_MONTHS_BY_TYPE: Partial<Record<PlanType, number>> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

export function durationMonthsFor(type: PlanType): number | null {
  return DURATION_MONTHS_BY_TYPE[type] ?? null;
}
