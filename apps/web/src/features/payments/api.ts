import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import { todayIso } from '../../lib/status';
import type { Payment } from '../../lib/database.types';
import { computeRemaining, sumAmounts } from './schemas';

// Payments reads (DATA-CONTRACT.md rows 10/11). RLS scopes every query to the
// caller's gym; no gym_id filter is needed (and would be redundant).

export interface PaymentListItem extends Payment {
  member_name: string;
}

export interface PaymentsQuery {
  from?: string;
  to?: string;
  memberId?: string;
}

export interface PaymentTotals {
  today: number;
  month: number;
}

export async function fetchPayments(query: PaymentsQuery): Promise<PaymentListItem[]> {
  let builder = supabase.from('payments').select('*');
  if (query.from) builder = builder.gte('paid_on', query.from);
  if (query.to) builder = builder.lte('paid_on', query.to);
  if (query.memberId) builder = builder.eq('member_id', query.memberId);

  const result = await builder
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500);
  if (result.error) throw toAppError(result.error);

  const memberIds = [...new Set(result.data.map((payment) => payment.member_id))];
  const names = new Map<string, string>();
  if (memberIds.length > 0) {
    const membersResult = await supabase.from('members').select('id, full_name').in('id', memberIds);
    if (membersResult.error) throw toAppError(membersResult.error);
    for (const member of membersResult.data) names.set(member.id, member.full_name);
  }

  return result.data.map((payment) => ({
    ...payment,
    member_name: names.get(payment.member_id) ?? '',
  }));
}

function monthStartIso(today: string): string {
  return `${today.slice(0, 8)}01`;
}

export async function fetchPaymentTotals(): Promise<PaymentTotals> {
  const today = todayIso();
  const [todayResult, monthResult] = await Promise.all([
    supabase.from('payments').select('amount_dzd').eq('paid_on', today),
    supabase.from('payments').select('amount_dzd').gte('paid_on', monthStartIso(today)).lte('paid_on', today),
  ]);
  if (todayResult.error) throw toAppError(todayResult.error);
  if (monthResult.error) throw toAppError(monthResult.error);

  return { today: sumAmounts(todayResult.data), month: sumAmounts(monthResult.data) };}

export interface ReceiptData {
  payment: Payment;
  memberName: string;
  memberPhone: string;
  planName: string | null;
  price: number | null;
  paid: number;
  remaining: number;
}

export async function fetchReceipt(id: string): Promise<ReceiptData> {
  const paymentResult = await supabase.from('payments').select('*').eq('id', id).maybeSingle();
  if (paymentResult.error) throw toAppError(paymentResult.error);
  if (!paymentResult.data) throw toAppError({ code: 'P0002' });

  const payment = paymentResult.data;
  const [memberResult, subResult, paidResult] = await Promise.all([
    supabase.from('members').select('full_name, phone').eq('id', payment.member_id).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('plan_name_snapshot, price_dzd')
      .eq('id', payment.subscription_id)
      .maybeSingle(),
    supabase.from('payments').select('amount_dzd').eq('subscription_id', payment.subscription_id),
  ]);
  if (memberResult.error) throw toAppError(memberResult.error);
  if (subResult.error) throw toAppError(subResult.error);
  if (paidResult.error) throw toAppError(paidResult.error);

  const paid = sumAmounts(paidResult.data);
  const price = subResult.data?.price_dzd ?? null;
  const remaining = computeRemaining(price, paid);

  return {
    payment,
    memberName: memberResult.data?.full_name ?? '',
    memberPhone: memberResult.data?.phone ?? '',
    planName: subResult.data?.plan_name_snapshot ?? null,
    price,
    paid,
    remaining,
  };
}
