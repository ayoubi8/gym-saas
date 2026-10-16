import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { qk, type PaymentFilter } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import { AppError } from '../../lib/pg-errors';
import type { Payment } from '../../lib/database.types';
import { fetchPayments, fetchPaymentTotals, fetchReceipt, type PaymentsQuery } from './api';
import type { DeletePaymentInput, EditPaymentInput, RecordPaymentInput } from './schemas';

// Payments writes (DATA-CONTRACT.md rows 10/11). record_payment is idempotent;
// edit/delete are online-only + reason-audited (NEVER queued offline, §7).

function invalidatePayments(client: QueryClient, memberId: string, paymentId?: string) {
  client.invalidateQueries({ queryKey: ['payments'] });
  client.invalidateQueries({ queryKey: qk.members() });
  client.invalidateQueries({ queryKey: qk.member(memberId) });
  client.invalidateQueries({ queryKey: qk.dashboard });
  if (paymentId) client.invalidateQueries({ queryKey: qk.payment(paymentId) });
}

function assertOnline() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new AppError('OFFLINE_EDIT_BLOCKED');
  }
}

export function usePayments(query: PaymentsQuery, enabled = true) {
  return useQuery({
    queryKey: qk.payments(query as PaymentFilter),
    queryFn: () => fetchPayments(query),
    enabled,
  });
}

export function usePaymentTotals() {
  return useQuery({ queryKey: qk.paymentTotals, queryFn: fetchPaymentTotals });
}

export function useReceipt(id: string | undefined) {
  return useQuery({
    queryKey: qk.payment(id ?? ''),
    queryFn: () => fetchReceipt(id as string),
    enabled: Boolean(id),
  });
}

export function useRecordPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id?: string; memberId: string; subscriptionId: string; input: RecordPaymentInput }) => {
      const id = vars.id ?? crypto.randomUUID();
      return runMutation<Payment>({
        key: ['payments'],
        rpc: 'record_payment',
        id,
        args: {
          p_id: id,
          p_subscription_id: vars.subscriptionId,
          p_amount_dzd: vars.input.amount_dzd,
          p_paid_on: vars.input.paid_on,
          p_method: vars.input.method,
          p_note: vars.input.note ?? null,
        },
      });
    },
    onSuccess: (_data, vars) => invalidatePayments(client, vars.memberId),
  });
}

export function useEditPayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; memberId: string; input: EditPaymentInput }) => {
      assertOnline();
      return runMutation<Payment>({
        key: ['payments'],
        rpc: 'edit_payment',
        id: crypto.randomUUID(),
        args: {
          p_id: vars.id,
          p_amount_dzd: vars.input.amount_dzd,
          p_paid_on: vars.input.paid_on,
          p_method: vars.input.method,
          p_note: vars.input.note ?? null,
          p_reason: vars.input.reason,
        },
      });
    },
    onSuccess: (_data, vars) => invalidatePayments(client, vars.memberId, vars.id),
  });
}

export function useDeletePayment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; memberId: string; input: DeletePaymentInput }) => {
      assertOnline();
      return runMutation<null>({
        key: ['payments'],
        rpc: 'delete_payment',
        id: crypto.randomUUID(),
        args: { p_id: vars.id, p_reason: vars.input.reason },
      });
    },
    onSuccess: (_data, vars) => invalidatePayments(client, vars.memberId, vars.id),
  });
}

/** Owner review: clear the "possible duplicate" flag on a payment (audited RPC). */
export function useClearPaymentDuplicate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; memberId: string }) =>
      runMutation<Payment>({
        key: ['payments'],
        rpc: 'clear_payment_duplicate',
        id: crypto.randomUUID(),
        args: { p_payment_id: vars.id },
      }),
    onSuccess: (_data, vars) => invalidatePayments(client, vars.memberId, vars.id),
  });
}
