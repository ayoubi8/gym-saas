import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import { todayIso } from '../../lib/status';
import { dashboardSummarySchema, type DashboardSummary } from './schemas';

// Dashboard reads (DATA-CONTRACT.md row 05). One `dashboard_summary()` call for
// the numbers + two 5-row previews. No writes.

export async function fetchDashboardSummary(gymId: string): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc('dashboard_summary', { p_gym_id: gymId });
  if (error) throw toAppError(error);
  return dashboardSummarySchema.parse(data);
}

export interface ExpiringRow {
  id: string;
  full_name: string;
  phone: string;
  end_date: string;
  plan_name: string | null;
}

export interface OwingRow {
  id: string;
  full_name: string;
  phone: string;
  owing: number;
}

function addDaysIso(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function namesFor(ids: string[]): Promise<Map<string, { full_name: string; phone: string }>> {
  const map = new Map<string, { full_name: string; phone: string }>();
  if (ids.length === 0) return map;
  const { data, error } = await supabase.from('members').select('id, full_name, phone').in('id', ids);
  if (error) throw toAppError(error);
  for (const member of data) map.set(member.id, { full_name: member.full_name, phone: member.phone });
  return map;
}

export async function fetchExpiringPreview(): Promise<ExpiringRow[]> {
  const today = todayIso();
  const { data, error } = await supabase
    .from('member_current_subscription')
    .select('member_id, end_date, plan_name_snapshot')
    .gte('end_date', today)
    .lte('end_date', addDaysIso(today, 7))
    .is('cancelled_at', null)
    .order('end_date', { ascending: true })
    .limit(5);
  if (error) throw toAppError(error);

  const ids = data.map((row) => row.member_id).filter((id): id is string => Boolean(id));
  const names = await namesFor(ids);

  return data
    .filter((row) => row.member_id)
    .map((row) => ({
      id: row.member_id as string,
      full_name: names.get(row.member_id as string)?.full_name ?? '',
      phone: names.get(row.member_id as string)?.phone ?? '',
      end_date: row.end_date as string,
      plan_name: row.plan_name_snapshot,
    }));
}

export async function fetchOwingPreview(): Promise<OwingRow[]> {
  const { data, error } = await supabase
    .from('member_balance')
    .select('member_id, total_owing')
    .gt('total_owing', 0)
    .order('total_owing', { ascending: false })
    .limit(5);
  if (error) throw toAppError(error);

  const ids = data.map((row) => row.member_id).filter((id): id is string => Boolean(id));
  const names = await namesFor(ids);

  return data
    .filter((row) => row.member_id)
    .map((row) => ({
      id: row.member_id as string,
      full_name: names.get(row.member_id as string)?.full_name ?? '',
      phone: names.get(row.member_id as string)?.phone ?? '',
      owing: row.total_owing ?? 0,
    }));
}
