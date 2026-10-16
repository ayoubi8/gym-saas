import { z } from 'zod';
import { todayIso } from '../../lib/status';
import type { Enums } from '../../lib/database.types';

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'ccp',
] as const satisfies readonly Enums<'payment_method'>[];

export const PAUSE_REASONS = [
  'travel',
  'injury',
  'ramadan',
  'other',
] as const satisfies readonly Enums<'pause_reason'>[];

export const EXTENSION_REASONS = [
  'compensation',
  'promotion',
  'other',
] as const satisfies readonly Enums<'extension_reason'>[];

function blankToUndefined(value: unknown): unknown {
  return value === '' || value === null || value === undefined ? undefined : value;
}

const optionalAmount = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ invalid_type_error: 'errors.invalidAmount' })
    .int('errors.invalidAmount')
    .min(0, 'errors.invalidAmount')
    .optional(),
);

const optionalDate = z.preprocess(blankToUndefined, z.string().min(1).optional());

export const assignSchema = z.object({
  plan_id: z.string().min(1, 'common.required'),
  start_date: z.string().min(1, 'common.required'),
  payment_amount: optionalAmount,
  payment_method: z.enum(PAYMENT_METHODS),
});
export type AssignInput = z.infer<typeof assignSchema>;

export const renewSchema = z.object({
  plan_id: z.string().min(1, 'common.required'),
  payment_amount: optionalAmount,
  payment_method: z.enum(PAYMENT_METHODS),
});
export type RenewInput = z.infer<typeof renewSchema>;

export const freezeSchema = z.object({
  start_date: z.string().min(1, 'common.required'),
  reason: z.enum(PAUSE_REASONS),
  planned_end: optionalDate,
  note: z.preprocess(blankToUndefined, z.string().max(200).optional()),
});
export type FreezeInput = z.infer<typeof freezeSchema>;

export const resumeSchema = z.object({
  resumed_on: z.string().min(1, 'common.required'),
});
export type ResumeInput = z.infer<typeof resumeSchema>;

export const extendSchema = z.object({
  days: z.coerce
    .number({ invalid_type_error: 'errors.invalidDays' })
    .int('errors.invalidDays')
    .positive('errors.invalidDays'),
  reason: z.enum(EXTENSION_REASONS),
  note: z.preprocess(blankToUndefined, z.string().max(200).optional()),
});
export type ExtendInput = z.infer<typeof extendSchema>;

export interface FirstPaymentJson {
  id: string;
  amount_dzd: number;
  paid_on: string;
  method: Enums<'payment_method'>;
}

/** Build the optional `p_first_payment` jsonb payload (null = no payment). */
export function buildFirstPayment(
  amount: number | undefined,
  method: Enums<'payment_method'>,
  paidOn?: string,
): FirstPaymentJson | null {
  if (amount === undefined) return null;
  return {
    id: crypto.randomUUID(),
    amount_dzd: amount,
    paid_on: paidOn ?? todayIso(),
    method,
  };
}
