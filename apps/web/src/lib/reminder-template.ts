// Reminder template helpers (Phase 9, PRD §5.8 / docs/plans/09-reminders.md).
// Pure + browser-free so both the /reminders deep-links and the /settings
// template editors share ONE variable contract. This is the TS mirror of the
// SQL `render_reminder()` / `validate_reminder_body()` (migration 0008).

import type { Enums } from './database.types';

/** The only variables allowed in a reminder template body. */
export const REMINDER_VARIABLES = ['memberName', 'endDate', 'gymName'] as const;
export type ReminderVariable = (typeof REMINDER_VARIABLES)[number];

export interface ReminderVars {
  memberName: string;
  endDate: string;
  gymName: string;
}

const VARIABLE_TOKEN = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;

/** Variable names referenced by a body (deduped, in first-seen order). */
export function extractReminderVariables(body: string): string[] {
  const found: string[] = [];
  const re = new RegExp(VARIABLE_TOKEN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (!found.includes(match[1])) found.push(match[1]);
  }
  return found;
}

/** Variables used but not allowed (empty = valid). Mirrors validate_reminder_body. */
export function unknownReminderVariables(body: string): string[] {
  const allowed = new Set<string>(REMINDER_VARIABLES);
  return extractReminderVariables(body).filter((name) => !allowed.has(name));
}

/** Substitute known variables, leaving unknown tokens untouched. */
export function renderReminderBody(body: string, vars: ReminderVars): string {
  const re = new RegExp(VARIABLE_TOKEN.source, 'g');
  return body.replace(re, (whole, name: string) =>
    (REMINDER_VARIABLES as readonly string[]).includes(name)
      ? String(vars[name as ReminderVariable] ?? '')
      : whole,
  );
}

/**
 * One-tap deep link with the rendered body prefilled. `phone` is the stored
 * E.164 value (`+213...`); wa.me needs it without the leading `+`.
 */
export function buildReminderDeepLink(
  channel: Enums<'channel'>,
  phone: string,
  body: string,
): string {
  const digits = phone.replace(/\D/g, '');
  const text = encodeURIComponent(body);
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/${digits}?text=${text}`;
    case 'sms':
      return `sms:${phone}?body=${text}`;
    case 'viber':
      return `viber://chat?number=%2B${digits}&text=${text}`;
  }
}

/**
 * i18n key describing a reminder row (R6). Manual sends are "Opened in
 * {channel}" — the word "sent" MUST NOT appear for manual rows; cron rows stay
 * `pending` ("to send") until a gateway moves them.
 */
export function reminderStatusKey(
  kind: Enums<'reminder_kind'>,
  status: Enums<'reminder_status'>,
): string {
  if (kind === 'manual') return 'reminders.openedIn';
  switch (status) {
    case 'pending':
      return 'reminders.statusPending';
    case 'delivered':
      return 'reminders.statusDelivered';
    case 'failed':
      return 'reminders.statusFailed';
    case 'sent':
      return 'reminders.statusSent';
  }
}

/** i18n key for a channel label. */
export function channelKey(channel: Enums<'channel'>): string {
  return `channel.${channel}`;
}

/** Template kinds an owner can edit (manual is a log kind, never a template). */
export const TEMPLATE_KINDS = ['before_expiry', 'expiry_day'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** Built-in fallbacks — mirror supabase/functions/_shared/reminder-templates.ts. */
export const DEFAULT_TEMPLATE_BODIES: Record<Enums<'lang'>, Record<TemplateKind, string>> = {
  ar: {
    before_expiry: 'مرحبًا {memberName}، سينتهي اشتراكك في {gymName} يوم {endDate}. يرجى التجديد.',
    expiry_day: 'مرحبًا {memberName}، ينتهي اشتراكك في {gymName} اليوم {endDate}. جدّده الآن.',
  },
  fr: {
    before_expiry:
      'Cher {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.',
    expiry_day:
      "Bonjour {memberName}, votre abonnement à {gymName} expire aujourd'hui ({endDate}). Renouvelez-le maintenant.",
  },
};

export interface TemplateLike {
  language: Enums<'lang'>;
  kind: string;
  body: string;
}

/** Saved template body for (language, kind), or the built-in fallback. */
export function pickTemplateBody(
  templates: TemplateLike[],
  language: Enums<'lang'>,
  kind: TemplateKind,
): string {
  const match = templates.find((tpl) => tpl.language === language && tpl.kind === kind);
  return match?.body ?? DEFAULT_TEMPLATE_BODIES[language][kind];
}
