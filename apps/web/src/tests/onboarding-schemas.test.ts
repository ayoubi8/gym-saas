import { describe, it, expect } from 'vitest';
import { durationMonthsFor, quickPlanSchema } from '../features/onboarding/schemas';

describe('quickPlanSchema', () => {
  it('accepts a valid time plan', () => {
    const result = quickPlanSchema.safeParse({ name: 'Mensuel', type: 'monthly', price_dzd: '3000' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.price_dzd).toBe(3000);
    }
  });

  it('rejects an empty name with the required key', () => {
    const result = quickPlanSchema.safeParse({ name: '  ', type: 'monthly', price_dzd: '3000' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name?.[0]).toBe('common.required');
    }
  });

  it('rejects a negative price with the invalidAmount key', () => {
    const result = quickPlanSchema.safeParse({ name: 'Mensuel', type: 'monthly', price_dzd: '-1' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.price_dzd?.[0]).toBe('errors.invalidAmount');
    }
  });

  it('rejects a non-time plan type during onboarding', () => {
    expect(quickPlanSchema.safeParse({ name: 'Pack', type: 'per_session', price_dzd: '3000' }).success).toBe(false);
  });
});

describe('durationMonthsFor', () => {
  it('maps each time plan to its calendar months', () => {
    expect(durationMonthsFor('monthly')).toBe(1);
    expect(durationMonthsFor('quarterly')).toBe(3);
    expect(durationMonthsFor('semiannual')).toBe(6);
    expect(durationMonthsFor('annual')).toBe(12);
  });

  it('returns null for non-time plans', () => {
    expect(durationMonthsFor('per_session')).toBeNull();
    expect(durationMonthsFor('class_pack')).toBeNull();
  });
});
