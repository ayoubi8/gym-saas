import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Enums, Reminder } from '../../lib/database.types';
import { fetchReminderLog, fetchReminderTemplates, fetchRemindersDue } from './api';

export function useRemindersDue(gymId: string | undefined, date: string) {
  return useQuery({
    queryKey: qk.remindersDue(date),
    queryFn: () => fetchRemindersDue(gymId as string, date),
    enabled: Boolean(gymId),
  });
}

export function useReminderLog(gymId: string | undefined, memberId?: string) {
  return useQuery({
    queryKey: qk.remindersLog(memberId),
    queryFn: () => fetchReminderLog(gymId as string, memberId),
    enabled: Boolean(gymId),
  });
}

export function useReminderTemplates(gymId: string | undefined) {
  return useQuery({
    queryKey: qk.reminderTemplates,
    queryFn: () => fetchReminderTemplates(gymId as string),
    enabled: Boolean(gymId),
  });
}

export interface LogManualReminderVars {
  id: string;
  memberId: string;
  subscriptionId: string | null;
  channel: Enums<'channel'>;
  language: Enums<'lang'>;
  bodyRendered: string;
  scheduledFor: string;
}

/**
 * Log an owner one-tap send (kind='manual'). Online-only (OFFLINE_EDIT_BLOCKED
 * when offline) and idempotent per member/day via reminders_manual_uidx, which
 * surfaces as ALREADY_SENT.
 */
export function useLogManualReminder(gymId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: LogManualReminderVars) =>
      runMutation<Reminder>({
        key: qk.reminders,
        rpc: 'log_manual_reminder',
        id: vars.id,
        args: {
          p_id: vars.id,
          p_gym_id: gymId,
          p_member_id: vars.memberId,
          p_subscription_id: vars.subscriptionId,
          p_channel: vars.channel,
          p_language: vars.language,
          p_body_rendered: vars.bodyRendered,
          p_scheduled_for: vars.scheduledFor,
        },
      }),
    onSuccess: (_data, vars) => {
      client.invalidateQueries({ queryKey: qk.reminders });
      client.invalidateQueries({ queryKey: qk.member(vars.memberId) });
    },
  });
}
