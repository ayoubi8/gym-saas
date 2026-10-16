import { z } from 'zod';
import type { Enums } from '../../lib/database.types';
import { PAYMENT_METHODS } from '../subscriptions/schemas';

// Payment forms (DATA-CONTRACT.md rows 10/11). Amount is a whole DZD integer > 0
// (DB CHECK payments.amount_dzd > 0). Edits/deletes REQUIRE a reason.

export { PAYMENT_METHODS };

function blankToUndefined(value: unknown): unknown {
  return value === '' || value === null || value === undefined ? undefined : value;
}

const amountDzd = z.preprocess(
  blankToUndefined,
  z.coerce
    .number({ invalid_type_error: 'payments.invalidAmount' })
    .int('payments.invalidAmount')
    .positive('payments.invalidAmount'),
);

const noteField = z.preprocess(blankToUndefined, z.string().max(200).optional());

const reasonField = z
  .string({ required_error: 'payments.reasonRequired' })
  .trim()
  .min(1, 'payments.reasonRequired')
  .max(200);

export const recordPaymentSchema = z.object({
  amount_dzd: amountDzd,
  paid_on: z.string().min(1, 'common.required'),
  method: z.enum(PAYMENT_METHODS),
  note: noteField,
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const editPaymentSchema = z.object({
  amount_dzd: amountDzd,
  paid_on: z.string().min(1, 'common.required'),
  method: z.enum(PAYMENT_METHODS),
  note: noteField,
  reason: reasonField,
});
export type EditPaymentInput = z.infer<typeof editPaymentSchema>;

export const deletePaymentSchema = z.object({ reason: reasonField });
export type DeletePaymentInput = z.infer<typeof deletePaymentSchema>;

export const PAYMENT_METHOD_VALUES = PAYMENT_METHODS as readonly Enums<'payment_method'>[];

/** Sum whole DZD amounts (used for day/month totals + subscription paid). */
export function sumAmounts(rows: { amount_dzd: number }[]): number {
  return rows.reduce((total, row) => total + row.amount_dzd, 0);
}

/** Remaining balance on a subscription; never negative. */
export function computeRemaining(price: number | null, paid: number): number {
  if (price === null) return 0;
  return Math.max(price - paid, 0);
}

