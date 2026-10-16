import { useMutation, useQuery } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Plan } from '../../lib/database.types';
import { fetchPlans } from './api';
import { durationMonthsFor, isTimePlan, type PlanInput } from './schemas';

export function usePlans() {
  return useQuery({ queryKey: qk.plans, queryFn: fetchPlans });
}

export interface UpsertPlanVars {
  id?: string;
  input: PlanInput;
}

export function useUpsertPlan(gymId: string) {
  return useMutation({
    mutationFn: (vars: UpsertPlanVars) =>
      runMutation<Plan>({
        key: qk.plans,
        rpc: 'upsert_plan',
        id: crypto.randomUUID(),
        args: {
          p_id: vars.id ?? crypto.randomUUID(),
          p_gym_id: gymId,
          p_name: vars.input.name,
          p_type: vars.input.type,
          p_price_dzd: vars.input.price_dzd,
          p_duration_months: isTimePlan(vars.input.type)
            ? durationMonthsFor(vars.input.type)
            : null,
          p_session_count: isTimePlan(vars.input.type) ? null : vars.input.session_count ?? null,
          p_validity_days: isTimePlan(vars.input.type) ? null : vars.input.validity_days ?? null,
        },
      }),
  });
}

export function useSetPlanActive() {
  return useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      runMutation<void>({
        key: qk.plans,
        rpc: 'set_plan_active',
        id: crypto.randomUUID(),
        args: { p_id: vars.id, p_active: vars.active },
      }),
  });
}
