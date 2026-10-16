import { describe, it, expect } from 'vitest';
import {
  computeRemaining,
  deletePaymentSchema,
  editPaymentSchema,
  recordPaymentSchema,
  sumAmounts,
} from '../features/payments/schemas';
import { AppError, mapError } from '../lib/pg-errors';

describe('recordPaymentSchema (Phase 4)', () => {
  it('accepts a whole positive DZD amount', () => {
    const result = recordPaymentSchema.safeParse({
      amount_dzd: '3000',
      paid_on: '2026-10-16',
      method: 'cash',
      note: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount_dzd).toBe(3000);
      expect(result.data.note).toBeUndefined();
    }
  });

  it('rejects zero, negative, fractional and blank amounts', () => {
    for (const amount of ['0', '-5', '12.5', '']) {
      const result = recordPaymentSchema.safeParse({
        amount_dzd: amount,
        paid_on: '2026-10-16',
        method: 'cash',
      });
      expect(result.success, amount).toBe(false);
      if (!result.success) {
        expect(result.error.flatten().fieldErrors.amount_dzd?.[0]).toBe('payments.invalidAmount');
      }
    }
  });

  it('requires a payment date', () => {
    const result = recordPaymentSchema.safeParse({ amount_dzd: '500', paid_on: '', method: 'ccp' });
    expect(result.success).toBe(false);
  });
});

describe('payment edit/delete reasons (Phase 4)', () => {
  it('requires a reason to edit', () => {
    const result = editPaymentSchema.safeParse({
      amount_dzd: '500',
      paid_on: '2026-10-16',
      method: 'cash',
      note: '',
      reason: '   ',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason?.[0]).toBe('payments.reasonRequired');
    }
  });

  it('requires a reason to delete', () => {
    const result = deletePaymentSchema.safeParse({ reason: '' });
    expect(result.success).toBe(false);
  });

  it('accepts a trimmed reason', () => {
    const result = deletePaymentSchema.safeParse({ reason: '  erreur de saisie  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe('erreur de saisie');
  });
});

describe('payment math (Phase 4)', () => {
  it('sums whole-DZD amounts', () => {
    expect(sumAmounts([])).toBe(0);
    expect(sumAmounts([{ amount_dzd: 1000 }, { amount_dzd: 2500 }])).toBe(3500);
  });

  it('computes remaining balance and never goes negative', () => {
    expect(computeRemaining(15000, 13000)).toBe(2000);
    expect(computeRemaining(15000, 15000)).toBe(0);
    expect(computeRemaining(15000, 16000)).toBe(0);
    expect(computeRemaining(null, 5000)).toBe(0);
  });
});

describe('payment error mapping (Phase 4)', () => {
  it('maps reason/amount/not-found codes to payment keys', () => {
    expect(mapError({ message: 'REASON_REQUIRED' })).toBe('payments.reasonRequired');
    expect(mapError({ message: 'INVALID_AMOUNT' })).toBe('payments.invalidAmount');
    expect(mapError({ message: 'PAYMENT_NOT_FOUND' })).toBe('payments.notFound');
    expect(mapError({ message: 'SUBSCRIPTION_NOT_FOUND' })).toBe('subscriptions.notFound');
  });

  it('does not confuse a missing payment with a missing member', () => {
    expect(mapError({ message: 'MEMBER_NOT_FOUND' })).toBe('errors.memberNotFound');
  });

  it('maps the offline edit guard', () => {
    expect(new AppError('OFFLINE_EDIT_BLOCKED').i18nKey).toBe('payments.offlineEditBlocked');
  });
});
