import { describe, expect, it } from 'vitest';
import ar from '../i18n/ar.json';
import fr from '../i18n/fr.json';
import {
  DEFAULT_TEMPLATE_BODIES,
  REMINDER_VARIABLES,
  buildReminderDeepLink,
  channelKey,
  extractReminderVariables,
  pickTemplateBody,
  reminderStatusKey,
  renderReminderBody,
  unknownReminderVariables,
} from '../lib/reminder-template';
import { settingsFormSchema, validateTemplateBody } from '../features/settings/schemas';

// Phase 9 (PRD §5.4 / docs/plans/09-reminders.md). Pure helpers only: the SQL
// due-set/cron path is covered by supabase/tests/08_reminders.sql (not runnable
// here — no local Postgres; recorded as a deviation).

type Json = { [key: string]: unknown };

function flatten(obj: Json, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...flatten(v as Json, key));
    else out.push(key);
  }
  return out;
}

const arKeys = new Set(flatten(ar as Json));
const frKeys = new Set(flatten(fr as Json));

describe('template rendering (FR-R: AR + FR)', () => {
  it('substitutes the three variables', () => {
    const rendered = renderReminderBody('Hi {memberName} — {gymName} — {endDate}', {
      memberName: 'Karim',
      endDate: '15 jan 2026',
      gymName: 'Club',
    });
    expect(rendered).toBe('Hi Karim — Club — 15 jan 2026');
  });

  it('renders an Arabic body without dropping variables', () => {
    const rendered = renderReminderBody(DEFAULT_TEMPLATE_BODIES.ar.before_expiry, {
      memberName: 'كريم',
      endDate: '15 جانفي 2026',
      gymName: 'نادي',
    });
    expect(rendered).toContain('كريم');
    expect(rendered).toContain('نادي');
    expect(rendered).not.toContain('{');
  });

  it('extracts referenced variables and flags unknown ones', () => {
    expect(extractReminderVariables('{memberName} {endDate} {memberName}')).toEqual([
      'memberName',
      'endDate',
    ]);
    expect(unknownReminderVariables('{memberName} {nope}')).toEqual(['nope']);
    expect(unknownReminderVariables('{memberName} {endDate} {gymName}')).toEqual([]);
  });

  it('pickTemplateBody falls back to the built-in default when unset', () => {
    expect(pickTemplateBody([], 'ar', 'before_expiry')).toBe(DEFAULT_TEMPLATE_BODIES.ar.before_expiry);
    expect(
      pickTemplateBody([{ language: 'fr', kind: 'before_expiry', body: 'X' }], 'fr', 'before_expiry'),
    ).toBe('X');
  });
});

describe('one-tap deep links (FR: manual send)', () => {
  const phone = '+213555123456';
  const body = 'Bonjour {name} & co'; // characters that must be encoded

  it('whatsapp uses wa.me without the plus and encodes the body', () => {
    const link = buildReminderDeepLink('whatsapp', phone, body);
    expect(link.startsWith('https://wa.me/213555123456?text=')).toBe(true);
    expect(link).toContain(encodeURIComponent(body));
  });

  it('sms uses the sms: scheme', () => {
    expect(buildReminderDeepLink('sms', phone, body)).toBe(
      `sms:${phone}?body=${encodeURIComponent(body)}`,
    );
  });

  it('viber uses the viber:// scheme with a +213 number', () => {
    const link = buildReminderDeepLink('viber', phone, body);
    expect(link.startsWith('viber://chat?number=%2B213555123456&text=')).toBe(true);
  });
});

describe('status wording (R6): manual sends never say "sent"', () => {
  it('manual rows are "Opened in {channel}" — never statusSent', () => {
    const key = reminderStatusKey('manual', 'sent');
    expect(key).toBe('reminders.openedIn');
    expect(key).not.toBe('reminders.statusSent');
  });

  it('cron rows keep the gateway lifecycle wording', () => {
    expect(reminderStatusKey('before_expiry', 'pending')).toBe('reminders.statusPending');
    expect(reminderStatusKey('before_expiry', 'delivered')).toBe('reminders.statusDelivered');
    expect(reminderStatusKey('before_expiry', 'failed')).toBe('reminders.statusFailed');
  });

  it('channel labels exist', () => {
    expect(channelKey('whatsapp')).toBe('channel.whatsapp');
    expect(channelKey('sms')).toBe('channel.sms');
    expect(channelKey('viber')).toBe('channel.viber');
  });
});

describe('settings/template validation (mirrors validate_reminder_body)', () => {
  it('accepts a body with only known variables', () => {
    expect(validateTemplateBody(`Salam {memberName}, {endDate} — ${REMINDER_VARIABLES[2]}`)).toBeNull();
  });

  it('rejects unknown variables and empty bodies', () => {
    expect(validateTemplateBody('Hello {who}')).toBe('settings.invalidVars');
    expect(validateTemplateBody('   ')).toBe('settings.emptyTemplate');
  });

  it('settings form enforces days 1..30 and at least one channel', () => {
    const base = {
      reminders_enabled: true,
      reminder_days_before: 3,
      reminder_on_expiry_day: false,
      enabled_channels: ['whatsapp'] as const,
      default_language: 'ar' as const,
    };
    expect(settingsFormSchema.safeParse(base).success).toBe(true);
    expect(
      settingsFormSchema.safeParse({ ...base, reminder_days_before: 0, enabled_channels: ['whatsapp'] }).success,
    ).toBe(false);
    expect(
      settingsFormSchema.safeParse({ ...base, reminder_days_before: 31, enabled_channels: ['whatsapp'] }).success,
    ).toBe(false);
    expect(settingsFormSchema.safeParse({ ...base, enabled_channels: [] }).success).toBe(false);
  });
});

describe('Phase 9 i18n keys resolve in BOTH locales', () => {
  it('every status/channel/settings key maps to a catalog entry', () => {
    const keys = [
      reminderStatusKey('manual', 'sent'),
      reminderStatusKey('before_expiry', 'pending'),
      reminderStatusKey('before_expiry', 'delivered'),
      reminderStatusKey('before_expiry', 'failed'),
      reminderStatusKey('before_expiry', 'sent'),
      channelKey('whatsapp'),
      channelKey('sms'),
      channelKey('viber'),
      'reminders.title',
      'reminders.disabled',
      'reminders.alreadySent',
      'reminders.offlineBlocked',
      'reminders.openIn',
      'reminders.settingsLink',
      'settings.title',
      'settings.invalidVars',
      'settings.daysRange',
      'settings.emptyTemplate',
      'settings.channelsRequired',
      'nav.reminders',
      'nav.settings',
    ];
    const missing: string[] = [];
    for (const key of keys) {
      if (!arKeys.has(key)) missing.push(`ar:${key}`);
      if (!frKeys.has(key)) missing.push(`fr:${key}`);
    }
    expect(missing).toEqual([]);
  });
});
