import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Pause, Subscription } from '../../lib/database.types';
import {
  buildFirstPayment,
  type AssignInput,
  type ExtendInput,
  type FreezeInput,
  type RenewInput,
  type ResumeInput,
} from './schemas';

// Subscription writes (DATA-CONTRACT.md rows 09/12). Each is a single RPC via
// runMutation; the members list + the affected member profile are invalidated.

function useMemberInvalidation() {
  const client = useQueryClient();
  return (memberId: string) => {
    client.invalidateQueries({ queryKey: qk.members() });
    client.invalidateQueries({ queryKey: qk.member(memberId) });
    client.invalidateQueries({ queryKey: qk.dashboard });
  };
}

export function useAssignSubscription(gymId: string) {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; input: AssignInput }) =>
      runMutation<Subscription>({
        key: qk.member(vars.memberId),
        rpc: 'assign_subscription',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_gym_id: gymId,
          p_member_id: vars.memberId,
          p_plan_id: vars.input.plan_id,
          p_start_date: vars.input.start_date,
          p_first_payment: buildFirstPayment(
            vars.input.payment_amount,
            vars.input.payment_method,
            vars.input.start_date,
          ),
        },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}

export function useRenewSubscription(gymId: string) {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; input: RenewInput }) =>
      runMutation<Subscription>({
        key: qk.member(vars.memberId),
        rpc: 'renew_subscription',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_gym_id: gymId,
          p_member_id: vars.memberId,
          p_plan_id: vars.input.plan_id,
          p_first_payment: buildFirstPayment(vars.input.payment_amount, vars.input.payment_method),
        },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}

export function usePauseSubscription(gymId: string) {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; subscriptionId: string; input: FreezeInput }) =>
      runMutation<Pause>({
        key: qk.member(vars.memberId),
        rpc: 'pause_subscription',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_subscription_id: vars.subscriptionId,
          p_gym_id: gymId,
          p_start_date: vars.input.start_date,
          p_reason: vars.input.reason,
          p_note: vars.input.note ?? null,
          p_planned_end: vars.input.planned_end ?? null,
        },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}

export function useResumeSubscription() {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; pauseId: string; input: ResumeInput }) =>
      runMutation<Subscription>({
        key: qk.member(vars.memberId),
        rpc: 'resume_subscription',
        id: crypto.randomUUID(),
        args: { p_pause_id: vars.pauseId, p_resumed_on: vars.input.resumed_on },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}

export function useExtendSubscription(gymId: string) {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; subscriptionId: string; input: ExtendInput }) =>
      runMutation<Subscription>({
        key: qk.member(vars.memberId),
        rpc: 'extend_subscription',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_gym_id: gymId,
          p_subscription_id: vars.subscriptionId,
          p_days: vars.input.days,
          p_reason: vars.input.reason,
          p_note: vars.input.note ?? null,
        },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}

export function useDeductSession(gymId: string) {
  const invalidateMember = useMemberInvalidation();
  return useMutation({
    mutationFn: (vars: { memberId: string; subscriptionId: string }) =>
      runMutation<Subscription>({
        key: qk.member(vars.memberId),
        rpc: 'deduct_session',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_gym_id: gymId,
          p_subscription_id: vars.subscriptionId,
        },
      }),
    onSuccess: (_data, vars) => invalidateMember(vars.memberId),
  });
}
