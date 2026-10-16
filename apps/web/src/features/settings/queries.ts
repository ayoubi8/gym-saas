import { useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from '../../lib/query-keys';
import { runMutation } from '../../lib/run-mutation';
import type { Enums, GymSettings, ReminderTemplate } from '../../lib/database.types';
import type { TemplateKind } from '../../lib/reminder-template';
import type { SettingsFormInput } from './schemas';

// Settings writes (DATA-CONTRACT.md row 15). Both are ONLINE-ONLY.

export function useUpdateSettings(gymId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: SettingsFormInput) =>
      runMutation<GymSettings>({
        key: qk.settings,
        rpc: 'update_gym_settings',
        id: crypto.randomUUID(),
        args: {
          p_gym_id: gymId,
          p_reminders_enabled: input.reminders_enabled,
          p_reminder_days_before: input.reminder_days_before,
          p_reminder_on_expiry_day: input.reminder_on_expiry_day,
          p_enabled_channels: input.enabled_channels,
          p_default_language: input.default_language,
        },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.settings });
      client.invalidateQueries({ queryKey: qk.session });
      client.invalidateQueries({ queryKey: qk.reminders });
    },
  });
}

export interface UpsertTemplateVars {
  id: string;
  language: Enums<'lang'>;
  kind: TemplateKind;
  body: string;
}

export function useUpsertReminderTemplate(gymId: string | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (vars: UpsertTemplateVars) =>
      runMutation<ReminderTemplate>({
        key: qk.reminderTemplates,
        rpc: 'upsert_reminder_template',
        id: vars.id,
        args: {
          p_id: vars.id,
          p_gym_id: gymId,
          p_language: vars.language,
          p_kind: vars.kind,
          p_body: vars.body,
        },
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: qk.reminderTemplates });
      client.invalidateQueries({ queryKey: qk.reminders });
    },
  });
}
