import { describe, it, expect } from 'vitest';
import { DASHBOARD_LINKS, dashboardSummarySchema, daysUntil } from '../features/dashboard/schemas';

describe('dashboardSummarySchema (Phase 5)', () => {
  it('parses the jsonb payload (numeric bigints coerced)', () => {
    const result = dashboardSummarySchema.safeParse({
      active_count: 12,
      revenue_today: '18000',
      revenue_month: 412000,
      expiring_week_count: 7,
      unpaid_total: 96500,
      unpaid_member_count: 11,
      as_of_date: '2026-10-16',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue_today).toBe(18000);
      expect(result.data.unpaid_member_count).toBe(11);
      expect(result.data.as_of_date).toBe('2026-10-16');
    }
  });

  it('rejects a negative counter', () => {
    const result = dashboardSummarySchema.safeParse({
      active_count: -1,
      revenue_today: 0,
      revenue_month: 0,
      expiring_week_count: 0,
      unpaid_total: 0,
      unpaid_member_count: 0,
      as_of_date: '2026-10-16',
    });
    expect(result.success).toBe(false);
  });
});

describe('daysUntil (Phase 5)', () => {
  it('computes whole days, including today and past', () => {
    expect(daysUntil('2026-10-16', '2026-10-16')).toBe(0);
    expect(daysUntil('2026-10-19', '2026-10-16')).toBe(3);
    expect(daysUntil('2026-10-10', '2026-10-16')).toBe(-6);
  });

  it('spans month boundaries', () => {
    expect(daysUntil('2026-11-01', '2026-10-30')).toBe(2);
  });
});

describe('DASHBOARD_LINKS (Phase 5)', () => {
  it('deep-links to correctly filtered lists', () => {
    expect(DASHBOARD_LINKS.activeMembers).toBe('/members?status=active');
    expect(DASHBOARD_LINKS.unpaid).toBe('/members?owing=1');
    expect(DASHBOARD_LINKS.revenue).toBe('/payments');
  });
});
