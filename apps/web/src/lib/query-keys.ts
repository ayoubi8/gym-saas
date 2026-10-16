import type { MemberStatus } from './database.types';

export interface MemberFilter {
  status?: MemberStatus;
  owing?: boolean;
  search?: string;
}

export interface PaymentFilter {
  from?: string;
  to?: string;
  memberId?: string;
}

// ONE query-key factory (FRONTEND-BACKEND.md §4). Hooks invalidate exactly these keys.
export const qk = {
  session: ['session'] as const,
  adminGyms: ['admin', 'gyms'] as const,
  plans: ['plans'] as const,
  members: (f?: MemberFilter) => ['members', f ?? 'all'] as const,
  member: (id: string) => ['member', id] as const,
  payments: (f?: PaymentFilter) => ['payments', f ?? 'all'] as const,
  paymentTotals: ['payments', 'totals'] as const,
  payment: (id: string) => ['payment', id] as const,
  dashboard: ['dashboard'] as const,
  expiringPreview: ['dashboard', 'expiring'] as const,
  owingPreview: ['dashboard', 'owing'] as const,
  reminders: ['reminders'] as const,
  remindersDue: (date: string) => ['reminders', 'due', date] as const,
  remindersLog: (memberId?: string) => ['reminders', 'log', memberId ?? 'all'] as const,
  reminderTemplates: ['reminders', 'templates'] as const,
  settings: ['settings'] as const,
  importBatch: (id: string) => ['import', id] as const,
  importBatches: ['import', 'batches'] as const,
};
