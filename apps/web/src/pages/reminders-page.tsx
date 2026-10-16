import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatDate, formatDateTime } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { todayIso } from '../lib/status';
import { useOnlineStatus } from '../lib/online';
import {
  buildReminderDeepLink,
  channelKey,
  pickTemplateBody,
  reminderStatusKey,
  renderReminderBody,
} from '../lib/reminder-template';
import type { Enums } from '../lib/database.types';
import { useSession } from '../features/auth/queries';
import { useGymSettings } from '../features/onboarding/queries';
import {
  useLogManualReminder,
  useReminderLog,
  useReminderTemplates,
  useRemindersDue,
} from '../features/reminders/queries';
import { ReminderDueCard } from '../features/reminders/components/reminder-due-card';
import type { DueReminder } from '../features/reminders/api';

const DEFAULT_CHANNELS: Enums<'channel'>[] = ['whatsapp'];

export function RemindersPage() {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const online = useOnlineStatus();
  const { session } = useSession();
  const gymId = session?.gym?.id;
  const gymName = session?.gym?.name ?? '';

  const today = todayIso();
  const due = useRemindersDue(gymId, today);
  const log = useReminderLog(gymId);
  const templates = useReminderTemplates(gymId);
  const settings = useGymSettings(gymId);
  const logManual = useLogManualReminder(gymId);

  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const channels: Enums<'channel'>[] = settings.data?.enabled_channels?.length
    ? settings.data.enabled_channels
    : DEFAULT_CHANNELS;

  const templateRows = useMemo(() => templates.data ?? [], [templates.data]);

  function bodyFor(row: DueReminder): string {
    const template = pickTemplateBody(
      templateRows,
      row.language,
      row.kind === 'expiry_day' ? 'expiry_day' : 'before_expiry',
    );
    return renderReminderBody(template, {
      memberName: row.full_name,
      endDate: formatDate(row.end_date, row.language),
      gymName,
    });
  }

  async function handleSend(row: DueReminder, channel: Enums<'channel'>) {
    setError(null);
    if (!online) {
      setError('reminders.offlineBlocked');
      return;
    }
    const body = bodyFor(row);
    const busyKey = `${row.member_id}:${channel}`;
    setBusyId(busyKey);
    try {
      await logManual.mutateAsync({
        id: crypto.randomUUID(),
        memberId: row.member_id,
        subscriptionId: row.subscription_id,
        channel,
        language: row.language,
        bodyRendered: body,
        scheduledFor: today,
      });
      window.location.href = buildReminderDeepLink(channel, row.phone, body);
    } catch (err) {
      setError(mapError(err));
    } finally {
      setBusyId(null);
    }
  }

  const remindersDisabled = settings.data ? !settings.data.reminders_enabled : false;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-ink-900">{t('reminders.title')}</h1>
          <span className="text-sm text-ink-600">{t('reminders.subtitle')}</span>
        </div>
        <Link
          to="/settings"
          className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:border-brand-500"
        >
          {t('reminders.settingsLink')}
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-100 bg-danger-100/60 p-3 text-sm text-danger-600"
        >
          {t(error)}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
          {t('reminders.dueSection')}
        </h2>

        {remindersDisabled ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
            {t('reminders.disabled')}
          </p>
        ) : due.isError ? (
          <p
            role="alert"
            className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600"
          >
            {t(mapError(due.error))}
          </p>
        ) : due.isPending ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">
            {t('common.loading')}
          </p>
        ) : (due.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">
            {t('reminders.none')}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {(due.data ?? []).map((row) => (
              <li key={`${row.member_id}:${row.subscription_id}`}>
                <ReminderDueCard
                  row={row}
                  channels={channels}
                  body={bodyFor(row)}
                  busyChannel={
                    busyId?.startsWith(`${row.member_id}:`)
                      ? (busyId.split(':')[1] as Enums<'channel'>)
                      : null
                  }
                  disabled={!online}
                  onSend={(channel) => handleSend(row, channel)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
          {t('reminders.logSection')}
        </h2>
        {log.isPending ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">
            {t('common.loading')}
          </p>
        ) : (log.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">
            {t('reminders.logEmpty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(log.data ?? []).map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-1 rounded-xl border border-line bg-surface p-3 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-ink-900">
                    <bdi>{entry.member?.full_name ?? '—'}</bdi>
                  </span>
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-600">
                    {t(reminderStatusKey(entry.kind, entry.status), {
                      channel: t(channelKey(entry.channel)),
                    })}
                  </span>
                </div>
                <bdi className="truncate text-sm text-ink-600">{entry.body_rendered}</bdi>
                <span className="text-xs text-ink-600">
                  {formatDateTime(entry.created_at, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
