import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { useSession } from '../features/auth/queries';
import { useGymSettings } from '../features/onboarding/queries';
import { useReminderTemplates } from '../features/reminders/queries';
import {
  SETTINGS_CHANNELS,
  settingsFormSchema,
  validateTemplateBody,
  validationMessageVars,
  type SettingsFormInput,
} from '../features/settings/schemas';
import { useUpdateSettings, useUpsertReminderTemplate } from '../features/settings/queries';
import {
  REMINDER_VARIABLES,
  TEMPLATE_KINDS,
  channelKey,
  pickTemplateBody,
  type TemplateKind,
} from '../lib/reminder-template';
import type { Enums } from '../lib/database.types';

const LANGUAGES: Enums<'lang'>[] = ['ar', 'fr'];

function draftKey(language: Enums<'lang'>, kind: TemplateKind): string {
  return `${language}:${kind}`;
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { session } = useSession();
  const gymId = session?.gym?.id;

  const settings = useGymSettings(gymId);
  const templates = useReminderTemplates(gymId);
  const updateSettings = useUpdateSettings(gymId);
  const upsertTemplate = useUpsertReminderTemplate(gymId);

  const templateRows = useMemo(() => templates.data ?? [], [templates.data]);

  const initialForm = useMemo<SettingsFormInput>(
    () => ({
      reminders_enabled: settings.data?.reminders_enabled ?? true,
      reminder_days_before: settings.data?.reminder_days_before ?? 3,
      reminder_on_expiry_day: settings.data?.reminder_on_expiry_day ?? false,
      enabled_channels: settings.data?.enabled_channels?.length
        ? settings.data.enabled_channels
        : ['whatsapp'],
      default_language: session?.gym?.default_language ?? 'ar',
    }),
    [settings.data, session],
  );

  const [formState, setFormState] = useState<SettingsFormInput | null>(null);
  const form = formState ?? initialForm;
  const patch = (part: Partial<SettingsFormInput>) => setFormState({ ...form, ...part });

  const [formError, setFormError] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState(false);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [templateErrors, setTemplateErrors] = useState<Record<string, string | null>>({});
  const [savedTemplate, setSavedTemplate] = useState<string | null>(null);

  function toggleChannel(channel: Enums<'channel'>) {
    const next = new Set(form.enabled_channels);
    if (next.has(channel)) next.delete(channel);
    else next.add(channel);
    patch({ enabled_channels: SETTINGS_CHANNELS.filter((c) => next.has(c)) });
  }

  function handleSaveSettings() {
    setFormError(null);
    setSavedSettings(false);
    const parsed = settingsFormSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    updateSettings.mutate(parsed.data, {
      onSuccess: () => setSavedSettings(true),
      onError: (error) => setFormError(mapError(error)),
    });
  }

  function valueFor(language: Enums<'lang'>, kind: TemplateKind): string {
    return drafts[draftKey(language, kind)] ?? pickTemplateBody(templateRows, language, kind);
  }

  async function handleSaveTemplate(language: Enums<'lang'>, kind: TemplateKind) {
    const key = draftKey(language, kind);
    const body = valueFor(language, kind);
    setSavedTemplate(null);

    const problem = validateTemplateBody(body);
    setTemplateErrors((prev) => ({ ...prev, [key]: problem }));
    if (problem) return;

    const existing = templateRows.find((tpl) => tpl.language === language && tpl.kind === kind);
    try {
      await upsertTemplate.mutateAsync({
        id: existing?.id ?? crypto.randomUUID(),
        language,
        kind,
        body,
      });
      setSavedTemplate(key);
    } catch (error) {
      setTemplateErrors((prev) => ({ ...prev, [key]: mapError(error) }));
    }
  }

  const variablesHint = validationMessageVars();

  return (
    <div className="flex flex-col gap-6 pb-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-bold text-ink-900">{t('settings.title')}</h1>
        <span className="text-sm text-ink-600">{t('settings.subtitle')}</span>
      </header>

      {formError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-100 bg-danger-100/60 p-3 text-sm text-danger-600"
        >
          {t(formError, { vars: variablesHint })}
        </p>
      ) : null}
      {savedSettings ? (
        <p className="rounded-xl border border-brand-100 bg-brand-100/50 p-3 text-sm font-semibold text-brand-700">
          {t('settings.saved')}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
          {t('settings.languageSection')}
        </h2>
        <span className="text-xs text-ink-600">{t('settings.languageHint')}</span>
        <div className="flex gap-2">
          {LANGUAGES.map((language) => (
            <label
              key={language}
              className={`flex min-h-[44px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                form.default_language === language
                  ? 'border-brand-500 bg-brand-100/50 text-brand-700'
                  : 'border-line text-ink-600'
              }`}
            >
              <input
                type="radio"
                name="default_language"
                className="sr-only"
                checked={form.default_language === language}
                onChange={() => patch({ default_language: language })}
              />
              {language === 'ar' ? t('common.arabic') : t('common.french')}
            </label>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
          {t('settings.remindersSection')}
        </h2>

        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-semibold text-ink-900">{t('settings.remindersEnabled')}</span>
            <span className="text-xs text-ink-600">{t('settings.remindersEnabledHint')}</span>
          </span>
          <input
            type="checkbox"
            className="h-6 w-6 shrink-0 accent-brand-700"
            checked={form.reminders_enabled}
            onChange={(e) => patch({ reminders_enabled: e.target.checked })}
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-semibold text-ink-900">{t('settings.daysBefore')}</span>
            <span className="text-xs text-ink-600">{t('settings.daysBeforeHint')}</span>
          </span>
          <input
            type="number"
            min={1}
            max={30}
            inputMode="numeric"
            disabled={!form.reminders_enabled}
            className="h-11 w-20 shrink-0 rounded-lg border border-line bg-surface px-3 text-center text-ink-900 focus:border-brand-500 focus:outline-none disabled:opacity-50"
            value={form.reminder_days_before}
            onChange={(e) => {
              const value = Number.parseInt(e.target.value, 10);
              patch({ reminder_days_before: Number.isNaN(value) ? 0 : value });
            }}
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="font-semibold text-ink-900">{t('settings.onExpiryDay')}</span>
          <input
            type="checkbox"
            className="h-6 w-6 shrink-0 accent-brand-700"
            disabled={!form.reminders_enabled}
            checked={form.reminder_on_expiry_day}
            onChange={(e) => patch({ reminder_on_expiry_day: e.target.checked })}
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="font-semibold text-ink-900">{t('settings.channels')}</span>
          <span className="text-xs text-ink-600">{t('settings.channelsHint')}</span>
          <div className="flex flex-wrap gap-2">
            {SETTINGS_CHANNELS.map((channel) => (
              <label
                key={channel}
                className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${
                  form.enabled_channels.includes(channel)
                    ? 'border-brand-500 bg-brand-100/50 text-brand-700'
                    : 'border-line text-ink-600'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-brand-700"
                  disabled={!form.reminders_enabled}
                  checked={form.enabled_channels.includes(channel)}
                  onChange={() => toggleChannel(channel)}
                />
                {t(channelKey(channel))}
              </label>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={updateSettings.isPending}
          className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-60"
        >
          {updateSettings.isPending ? t('common.saving') : t('settings.save')}
        </button>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
            {t('settings.templatesSection')}
          </h2>
          <span className="text-xs text-ink-600">
            {t('settings.templatesHint', { vars: variablesHint })}
          </span>
        </div>

        {TEMPLATE_KINDS.map((kind) => (
          <div key={kind} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
            <span className="font-semibold text-ink-900">
              {kind === 'before_expiry' ? t('settings.kindBefore') : t('settings.kindExpiryDay')}
            </span>
            <div className="grid gap-3 md:grid-cols-2">
              {LANGUAGES.map((language) => {
                const key = draftKey(language, kind);
                const error = templateErrors[key];
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-ink-600">
                      {language === 'ar' ? t('common.arabic') : t('common.french')}
                    </span>
                    <textarea
                      dir={language === 'ar' ? 'rtl' : 'ltr'}
                      rows={4}
                      className="w-full rounded-lg border border-line bg-surface p-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
                      value={valueFor(language, kind)}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {REMINDER_VARIABLES.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() =>
                            setDrafts((prev) => ({
                              ...prev,
                              [key]: `${valueFor(language, kind)}{${variable}}`,
                            }))
                          }
                          className="rounded-full border border-line px-2 py-1 text-xs font-semibold text-ink-600 transition hover:border-brand-500"
                        >
                          {`{${variable}}`}
                        </button>
                      ))}
                    </div>
                    {error ? (
                      <span className="text-xs font-semibold text-danger-600">
                        {t(error, { vars: variablesHint })}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleSaveTemplate(language, kind)}
                      disabled={upsertTemplate.isPending}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-500 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100/60 disabled:opacity-60"
                    >
                      {savedTemplate === key ? t('settings.templateSaved') : t('settings.saveTemplate')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
