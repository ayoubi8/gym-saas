import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Enums, GymSettings, Plan } from '../../lib/database.types';
import type { AppLang } from '../../i18n';
import { fetchGymPlans, fetchGymSettings, updateProfileLanguage } from './api';
import { durationMonthsFor, type QuickPlanInput } from './schemas';

export function useGymSettings(gymId: string | undefined) {
  return useQuery({
    queryKey: qk.settings,
    queryFn: () => fetchGymSettings(gymId as string),
    enabled: Boolean(gymId),
  });
}

export function useGymPlans(gymId: string | undefined) {
  return useQuery({
    queryKey: qk.plans,
    queryFn: () => fetchGymPlans(gymId as string),
    enabled: Boolean(gymId),
  });
}

export function useQuickCreatePlan(gymId: string) {
  return useMutation({
    mutationFn: (input: QuickPlanInput) =>
      runMutation<Plan>({
        key: qk.plans,
        rpc: 'upsert_plan',
        id: crypto.randomUUID(),
        args: {
          p_id: crypto.randomUUID(),
          p_gym_id: gymId,
          p_name: input.name,
          p_type: input.type,
          p_price_dzd: input.price_dzd,
          p_duration_months: durationMonthsFor(input.type),
        },
      }),
  });
}

interface CompleteOnboardingVars {
  gymId: string;
  userId: string;
  settings: GymSettings | null;
  language: AppLang;
}

export function useCompleteOnboarding() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (variables: CompleteOnboardingVars): Promise<GymSettings> => {
      // Persist language preference (best-effort: never blocks setup completion).
      await updateProfileLanguage(variables.userId, variables.language).catch(() => undefined);

      return runMutation<GymSettings>({
        key: qk.settings,
        rpc: 'update_gym_settings',
        id: crypto.randomUUID(),
        args: {
          p_gym_id: variables.gymId,
          p_reminders_enabled: variables.settings?.reminders_enabled ?? true,
          p_reminder_days_before: variables.settings?.reminder_days_before ?? 3,
          p_reminder_on_expiry_day: variables.settings?.reminder_on_expiry_day ?? false,
          p_enabled_channels: (variables.settings?.enabled_channels ?? ['whatsapp']) as Enums<'channel'>[],
          p_onboarding_completed: true,
        },
      });
    },
    onSuccess: () => client.invalidateQueries({ queryKey: qk.session }),
  });
}
