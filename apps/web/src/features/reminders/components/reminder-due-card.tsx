import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../lib/format';
import { useFormatLang } from '../../../lib/use-format';
import { todayIso } from '../../../lib/status';
import { channelKey } from '../../../lib/reminder-template';
import type { Enums } from '../../../lib/database.types';
import { daysUntil } from '../../dashboard/schemas';
import type { DueReminder } from '../api';

interface ReminderDueCardProps {
  row: DueReminder;
  channels: Enums<'channel'>[];
  body: string;
  busyChannel: Enums<'channel'> | null;
  disabled: boolean;
  onSend: (channel: Enums<'channel'>) => void;
}

export function ReminderDueCard({
  row,
  channels,
  body,
  busyChannel,
  disabled,
  onSend,
}: ReminderDueCardProps) {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const days = daysUntil(row.end_date, todayIso());

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-ink-900">
            <bdi>{row.full_name || '—'}</bdi>
          </span>
          <span className="truncate text-xs text-ink-600">
            <bdi>{row.phone}</bdi> · {formatDate(row.end_date, lang)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
            row.kind === 'expiry_day'
              ? 'bg-danger-100 text-danger-600'
              : 'bg-warn-100 text-warn-600'
          }`}
        >
          {row.kind === 'expiry_day'
            ? t('reminders.kindExpiryDay')
            : days <= 0
              ? t('reminders.expiresToday')
              : t('reminders.inDays', { count: days })}
        </span>
      </div>

      <p className="rounded-lg bg-surface-2 p-2.5 text-sm leading-relaxed text-ink-600">
        <bdi>{body}</bdi>
      </p>

      <div className="flex flex-wrap gap-2">
        {channels.map((channel) => (
          <button
            key={channel}
            type="button"
            disabled={disabled || busyChannel !== null}
            onClick={() => onSend(channel)}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-brand-500 px-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyChannel === channel
              ? t('common.saving')
              : t('reminders.openIn', { channel: t(channelKey(channel)) })}
          </button>
        ))}
      </div>
    </article>
  );
}
