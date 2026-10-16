import { z } from 'zod';
import { REMINDER_VARIABLES, unknownReminderVariables } from '../../lib/reminder-template';

// Settings form schemas (DATA-CONTRACT.md row 15). Messages are i18n KEYS,
// rendered by the page with t(); zod only carries them as strings.

export const SETTINGS_CHANNELS = ['whatsapp', 'sms', 'viber'] as const;

export const settingsFormSchema = z.object({
  reminders_enabled: z.boolean(),
  reminder_days_before: z
    .number()
    .int()
    .min(1, 'settings.daysRange')
    .max(30, 'settings.daysRange'),
  reminder_on_expiry_day: z.boolean(),
  enabled_channels: z.array(z.enum(SETTINGS_CHANNELS)).min(1, 'settings.channelsRequired'),
  default_language: z.enum(['ar', 'fr']),
});

export type SettingsFormInput = z.infer<typeof settingsFormSchema>;

export const templateFormSchema = z.object({
  body: z.string().trim().min(1, 'settings.emptyTemplate'),
});

export type TemplateFormInput = z.infer<typeof templateFormSchema>;

/**
 * Returns an i18n key for the first problem, or null when valid. Mirrors the
 * SQL validate_reminder_body(): non-empty and only known variables.
 */
export function validateTemplateBody(body: string): string | null {
  const parsed = templateFormSchema.safeParse({ body });
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'settings.emptyTemplate';
  if (unknownReminderVariables(body).length > 0) return 'settings.invalidVars';
  return null;
}

export const reminderVariableList = REMINDER_VARIABLES;

export function validationMessageVars(): string {
  return reminderVariableList.map((name) => `{${name}}`).join(' ');
}
