import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import type {
  Enums,
  Member,
  MemberStatus,
  Pause,
  Payment,
  Subscription,
} from '../../lib/database.types';

// Members reads (DATA-CONTRACT.md rows 06/07). Status is never stored: it comes
// from the member_status view (now security_invoker, see migration 0003).

export interface MemberListItem {
  id: string;
  full_name: string;
  phone: string;
  language: Enums<'lang'> | null;
  status: MemberStatus;
  endDate: string | null;
  subscriptionId: string | null;
  sessionsRemaining: number | null;
  planType: Enums<'plan_type'> | null;
  owing: number;
}

interface StatusRow {
  member_id: string | null;
  status: string | null;
  end_date: string | null;
  subscription_id: string | null;
  sessions_remaining: number | null;
  plan_type_snapshot: Enums<'plan_type'> | null;
}

function asStatus(value: string | null | undefined): MemberStatus {
  return value === 'active' || value === 'frozen' ? value : 'expired';
}

export async function fetchMembers(): Promise<MemberListItem[]> {
  const [membersResult, statusResult, balanceResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, full_name, phone, language, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('member_status')
      .select('member_id, status, end_date, subscription_id, sessions_remaining, plan_type_snapshot'),
    supabase.from('member_balance').select('member_id, total_owing'),
  ]);

  if (membersResult.error) throw toAppError(membersResult.error);
  if (statusResult.error) throw toAppError(statusResult.error);
  if (balanceResult.error) throw toAppError(balanceResult.error);

  const statusByMember = new Map<string, StatusRow>();
  for (const row of statusResult.data as StatusRow[]) {
    if (row.member_id) statusByMember.set(row.member_id, row);
  }

  const owingByMember = new Map<string, number>();
  for (const row of balanceResult.data) {
    if (row.member_id) owingByMember.set(row.member_id, row.total_owing ?? 0);
  }

  return membersResult.data.map((member) => {
    const status = statusByMember.get(member.id);
    return {
      id: member.id,
      full_name: member.full_name,
      phone: member.phone,
      language: member.language,
      status: asStatus(status?.status),
      endDate: status?.end_date ?? null,
      subscriptionId: status?.subscription_id ?? null,
      sessionsRemaining: status?.sessions_remaining ?? null,
      planType: status?.plan_type_snapshot ?? null,
      owing: owingByMember.get(member.id) ?? 0,
    };
  });
}

export interface MemberDetail {
  member: Member;
  status: MemberStatus;
  currentSubscription: Subscription | null;
  owing: number;
  payments: Payment[];
  subscriptions: Subscription[];
  pauses: Pause[];
}

export async function fetchMember(id: string): Promise<MemberDetail> {
  const memberResult = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (memberResult.error) throw toAppError(memberResult.error);
  if (!memberResult.data) throw toAppError({ code: 'P0002' });

  const [statusResult, currentResult, balanceResult, paymentsResult, subsResult] = await Promise.all([
    supabase.from('member_status').select('status').eq('member_id', id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('*')
      .eq('member_id', id)
      .is('cancelled_at', null)
      .order('end_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from('member_balance').select('total_owing').eq('member_id', id).maybeSingle(),
    supabase.from('payments').select('*').eq('member_id', id).order('paid_on', { ascending: false }),
    supabase.from('subscriptions').select('*').eq('member_id', id).order('created_at', { ascending: false }),
  ]);

  if (statusResult.error) throw toAppError(statusResult.error);
  if (currentResult.error) throw toAppError(currentResult.error);
  if (balanceResult.error) throw toAppError(balanceResult.error);
  if (paymentsResult.error) throw toAppError(paymentsResult.error);
  if (subsResult.error) throw toAppError(subsResult.error);

  const subscriptions = subsResult.data;
  const subscriptionIds = subscriptions.map((subscription) => subscription.id);

  let pauses: Pause[] = [];
  if (subscriptionIds.length > 0) {
    const pausesResult = await supabase
      .from('pauses')
      .select('*')
      .in('subscription_id', subscriptionIds)
      .order('start_date', { ascending: false });
    if (pausesResult.error) throw toAppError(pausesResult.error);
    pauses = pausesResult.data;
  }

  return {
    member: memberResult.data,
    status: asStatus(statusResult.data?.status),
    currentSubscription: currentResult.data,
    owing: balanceResult.data?.total_owing ?? 0,
    payments: paymentsResult.data,
    subscriptions,
    pauses,
  };
}
