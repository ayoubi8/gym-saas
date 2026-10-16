import { z } from 'zod';

// Dashboard summary payload (DATA-CONTRACT.md row 05). dashboard_summary() returns
// jsonb; parsing keeps the widget numbers typed + validated.

export const dashboardSummarySchema = z.object({
  active_count: z.coerce.number().int().nonnegative(),
  revenue_today: z.coerce.number().int().nonnegative(),
  revenue_month: z.coerce.number().int().nonnegative(),
  expiring_week_count: z.coerce.number().int().nonnegative(),
  unpaid_total: z.coerce.number().int().nonnegative(),
  unpaid_member_count: z.coerce.number().int().nonnegative(),
  as_of_date: z.string(),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

/** Whole days from `today` (ISO) to `endDate` (ISO); negative when past. */
export function daysUntil(endDate: string, today: string): number {
  const start = new Date(`${today}T00:00:00`).getTime();
  const end = new Date(`${endDate}T00:00:00`).getTime();
  return Math.round((end - start) / 86_400_000);
}

/** Widget deep-links (each widget is tappable, PRD FR-D*). */
export const DASHBOARD_LINKS = {
  activeMembers: '/members?status=active',
  revenue: '/payments',
  expiring: '/members?status=active',
  unpaid: '/members?owing=1',
} as const;
