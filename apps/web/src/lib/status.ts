import type { MemberStatus } from './database.types';

// Thin TS mirror of the SQL `member_status` view (DATA-MODEL.md).
// Used ONLY for instant UI (optimistic rows/previews). A parity test pins it to
// the SQL fixtures (see src/tests/status.test.ts). SQL stays the source of truth.

export interface MemberStatusInput {
  /** member_current_subscription.id is not null */
  hasSubscription: boolean;
  /** an open pause (resumed_on IS NULL) exists on the current subscription */
  isFrozen: boolean;
  endDate: string | null;
  sessionsRemaining?: number | null;
  /** ISO `YYYY-MM-DD`, defaults to the device's local today (gym tz in SQL). */
  today?: string;
}

export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getMemberStatus(input: MemberStatusInput): MemberStatus {
  if (!input.hasSubscription) return 'expired';
  if (input.isFrozen) return 'frozen';

  const today = input.today ?? todayIso();
  const remaining = input.sessionsRemaining;

  if (
    input.endDate !== null &&
    input.endDate >= today &&
    (remaining === null || remaining === undefined || remaining > 0)
  ) {
    return 'active';
  }
  return 'expired';
}
