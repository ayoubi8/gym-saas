import { describe, it, expect } from 'vitest';
import { getMemberStatus, todayIso, type MemberStatusInput } from '../lib/status';

// Parity fixtures pinned to the SQL `member_status` view + supabase/seed/seed.sql.
// `sqlStatus` is the result the view returns for the same situation; the TS mirror
// must match exactly (FRONTEND-BACKEND.md §2). Dates are frozen to avoid tz drift.
const TODAY = '2026-10-15';

interface Fixture {
  name: string;
  input: MemberStatusInput;
  sqlStatus: 'active' | 'frozen' | 'expired';
}

const FIXTURES: Fixture[] = [
  {
    name: 'seed: active member (end today+20)',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-11-04', sessionsRemaining: null, today: TODAY },
    sqlStatus: 'active',
  },
  {
    name: 'seed: expiring in 3 days is still active',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-10-18', sessionsRemaining: null, today: TODAY },
    sqlStatus: 'active',
  },
  {
    name: 'seed: end date passed -> expired',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-10-10', sessionsRemaining: null, today: TODAY },
    sqlStatus: 'expired',
  },
  {
    name: 'seed: open pause -> frozen (overrides active)',
    input: { hasSubscription: true, isFrozen: true, endDate: '2026-11-04', sessionsRemaining: null, today: TODAY },
    sqlStatus: 'frozen',
  },
  {
    name: 'seed: owing member is still active (balance is separate)',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-11-09', sessionsRemaining: null, today: TODAY },
    sqlStatus: 'active',
  },
  {
    name: 'seed: member with no subscription -> expired',
    input: { hasSubscription: false, isFrozen: false, endDate: null, sessionsRemaining: null, today: TODAY },
    sqlStatus: 'expired',
  },
  {
    name: 'boundary: end date === today is active',
    input: { hasSubscription: true, isFrozen: false, endDate: TODAY, sessionsRemaining: null, today: TODAY },
    sqlStatus: 'active',
  },
  {
    name: 'class pack with sessions remaining -> active',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-11-20', sessionsRemaining: 3, today: TODAY },
    sqlStatus: 'active',
  },
  {
    name: 'class pack exhausted (0 sessions) -> expired',
    input: { hasSubscription: true, isFrozen: false, endDate: '2026-11-20', sessionsRemaining: 0, today: TODAY },
    sqlStatus: 'expired',
  },
];

describe('getMemberStatus parity vs SQL member_status fixtures', () => {
  it.each(FIXTURES)('$name', ({ input, sqlStatus }) => {
    expect(getMemberStatus(input)).toBe(sqlStatus);
  });

  it('todayIso returns a local YYYY-MM-DD string', () => {
    expect(todayIso(new Date(2026, 9, 15))).toBe('2026-10-15');
    expect(todayIso(new Date(2026, 0, 3))).toBe('2026-01-03');
  });
});
