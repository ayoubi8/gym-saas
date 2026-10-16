import { describe, it, expect } from 'vitest';
import { memberSchema } from '../features/members/schemas';
import { planSchema, isTimePlan, durationMonthsFor } from '../features/plans/schemas';
import {
  assignSchema,
  buildFirstPayment,
  extendSchema,
  freezeSchema,
  renewSchema,
} from '../features/subscriptions/schemas';

describe('memberSchema (Phase 3)', () => {
  it('accepts local, international and Arabic-Indic phone formats', () => {
    for (const phone of ['0555 12 34 56', '+213 555 12 34 56', '٠٥٥٥ ١٢ ٣٤ ٥٦']) {
      const result = memberSchema.safeParse({ full_name: 'Karim', phone });
      expect(result.success, phone).toBe(true);
    }
  });

  it('rejects a phone that is not Algerian', () => {
    const result = memberSchema.safeParse({ full_name: 'Karim', phone: '0012345' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone?.[0]).toBe('members.invalidPhone');
    }
  });

  it('requires a name', () => {
    const result = memberSchema.safeParse({ full_name: '   ', phone: '0555 12 34 56' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.full_name?.[0]).toBe('common.required');
    }
  });
});

describe('planSchema (Phase 3)', () => {
  it('accepts a time plan without session fields', () => {
    const result = planSchema.safeParse({ name: 'Mensuel', type: 'monthly', price_dzd: '3000' });
    expect(result.success).toBe(true);
  });

  it('requires a session count for session plans', () => {
    const result = planSchema.safeParse({ name: 'Pack', type: 'class_pack', price_dzd: '5000' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.session_count?.[0]).toBe('common.required');
    }
  });

  it('accepts a session plan with a count and blank validity', () => {
    const result = planSchema.safeParse({
      name: 'Pack 10',
      type: 'class_pack',
      price_dzd: '5000',
      session_count: '10',
      validity_days: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.session_count).toBe(10);
      expect(result.data.validity_days).toBeUndefined();
    }
  });

  it('rejects a negative price', () => {
    const result = planSchema.safeParse({ name: 'Mensuel', type: 'monthly', price_dzd: '-1' });
    expect(result.success).toBe(false);
  });

  it('classifies and derives durations', () => {
    expect(isTimePlan('monthly')).toBe(true);
    expect(isTimePlan('per_session')).toBe(false);
    expect(durationMonthsFor('annual')).toBe(12);
    expect(durationMonthsFor('class_pack')).toBeNull();
  });
});

describe('subscription schemas (Phase 3)', () => {
  it('treats a blank payment amount as no payment', () => {
    const result = assignSchema.safeParse({
      plan_id: 'p1',
      start_date: '2026-10-16',
      payment_amount: '',
      payment_method: 'cash',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payment_amount).toBeUndefined();
  });

  it('accepts a zero payment amount', () => {
    const result = renewSchema.safeParse({ plan_id: 'p1', payment_amount: '0', payment_method: 'cash' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.payment_amount).toBe(0);
  });

  it('normalizes a blank planned end date to undefined', () => {
    const result = freezeSchema.safeParse({
      start_date: '2026-10-16',
      reason: 'travel',
      planned_end: '',
      note: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planned_end).toBeUndefined();
      expect(result.data.note).toBeUndefined();
    }
  });

  it('rejects non-positive extension days', () => {
    for (const days of ['0', '-3', '']) {
      const result = extendSchema.safeParse({ days, reason: 'compensation' });
      expect(result.success, days).toBe(false);
    }
  });

  it('builds the first-payment payload only when an amount is given', () => {
    expect(buildFirstPayment(undefined, 'cash')).toBeNull();
    const payment = buildFirstPayment(0, 'ccp', '2026-10-16');
    expect(payment).not.toBeNull();
    if (payment) {
      expect(payment.amount_dzd).toBe(0);
      expect(payment.method).toBe('ccp');
      expect(payment.paid_on).toBe('2026-10-16');
      expect(payment.id).toBeTruthy();
    }
  });
});
