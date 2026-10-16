import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatCurrency, formatDate } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { todayIso } from '../lib/status';
import { useOnlineStatus } from '../lib/online';
import { useMembers } from '../features/members/queries';
import { usePaymentTotals, usePayments, useClearPaymentDuplicate } from '../features/payments/queries';
import {
  DeletePaymentDialog,
  EditPaymentDialog,
  RecordPaymentDialog,
} from '../features/payments/components/dialogs';
import type { Payment } from '../lib/database.types';

type Action = { kind: 'edit' | 'delete'; payment: Payment } | null;

const inputClass =
  'h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

function monthStartIso(today: string): string {
  return `${today.slice(0, 8)}01`;
}

export function PaymentsListPage() {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const online = useOnlineStatus();
  const today = todayIso();

  const [from, setFrom] = useState(monthStartIso(today));
  const [to, setTo] = useState(today);
  const [action, setAction] = useState<Action>(null);
  const [recordOpen, setRecordOpen] = useState(false);

  const query = useMemo(
    () => ({ from: from || undefined, to: to || undefined }),
    [from, to],
  );
  const payments = usePayments(query);
  const totals = usePaymentTotals();
  const members = useMembers();
  const clearDuplicate = useClearPaymentDuplicate();

  const owingByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const member of members.data ?? []) map.set(member.id, member.owing);
    return map;
  }, [members.data]);

  const rows = payments.data ?? [];

  return (
    <div className="flex flex-col gap-4 pb-20">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t('payments.title')}</h1>
          <p className="text-sm text-ink-600">{t('payments.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setRecordOpen(true)}
          className="h-10 shrink-0 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white transition hover:bg-brand-900"
        >
          {t('payments.record')}
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
          <p className="text-xs text-ink-600">{t('payments.today')}</p>
          <p className="mt-1 text-lg font-bold text-brand-700">
            {totals.data ? formatCurrency(totals.data.today, lang) : t('common.loading')}
          </p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-3 shadow-sm">
          <p className="text-xs text-ink-600">{t('payments.thisMonth')}</p>
          <p className="mt-1 text-lg font-bold text-brand-700">
            {totals.data ? formatCurrency(totals.data.month, lang) : t('common.loading')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm">
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600">
          {t('payments.from')}
          <input type="date" dir="ltr" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-600">
          {t('payments.to')}
          <input type="date" dir="ltr" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button
          type="button"
          onClick={() => {
            setFrom('');
            setTo('');
          }}
          className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
        >
          {t('payments.allDates')}
        </button>
      </div>

      {payments.isError ? (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
          {t(mapError(payments.error))}
        </p>
      ) : null}

      {payments.isPending ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">{t('common.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">{t('payments.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((payment) => {
            const owing = owingByMember.get(payment.member_id) ?? 0;
            return (
              <li
                key={payment.id}
                className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col">
                  <Link to={`/members/${payment.member_id}`} className="truncate font-semibold text-ink-900 hover:underline">
                    <bdi>{payment.member_name || '—'}</bdi>
                  </Link>
                  <span className="text-xs text-ink-600">
                    {formatDate(payment.paid_on, lang)} · {t(`paymentMethod.${payment.method}`)}
                    {payment.receipt_no ? ` · #${payment.receipt_no}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="font-bold text-brand-700">{formatCurrency(payment.amount_dzd, lang)}</span>
                  {owing > 0 ? (
                    <span className="rounded-full bg-danger-100 px-2 py-0.5 text-xs font-semibold text-danger-600">
                      {t('payments.owing', { amount: formatCurrency(owing, lang) })}
                    </span>
                  ) : null}
                  {payment.flagged_duplicate ? (
                    <span className="rounded-full bg-warn-100 px-2 py-0.5 text-xs font-semibold text-warn-600">
                      {t('payments.duplicateBadge')}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-1">
                    <Link
                      to={`/payments/${payment.id}/receipt`}
                      className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-900 transition hover:bg-surface-2"
                    >
                      {t('payments.receipt')}
                    </Link>
                    {payment.flagged_duplicate ? (
                      <button
                        type="button"
                        disabled={!online || clearDuplicate.isPending}
                        title={online ? undefined : t('payments.offlineEditBlocked')}
                        onClick={() => clearDuplicate.mutate({ id: payment.id, memberId: payment.member_id })}
                        className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-warn-600 transition hover:bg-warn-100/60 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {t('payments.duplicateReview')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={!online}
                      title={online ? undefined : t('payments.offlineEditBlocked')}
                      onClick={() => setAction({ kind: 'edit', payment })}
                      className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-ink-900 transition hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      disabled={!online}
                      title={online ? undefined : t('payments.offlineEditBlocked')}
                      onClick={() => setAction({ kind: 'delete', payment })}
                      className="rounded-lg border border-line px-2 py-1 text-xs font-semibold text-danger-600 transition hover:bg-danger-100/60 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!online ? (
        <p className="rounded-lg bg-warn-100/60 px-3 py-2 text-sm text-warn-600">{t('payments.offlineEditBlocked')}</p>
      ) : null}

      <RecordPaymentDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
      {action?.kind === 'edit' ? (
        <EditPaymentDialog open onClose={() => setAction(null)} payment={action.payment} />
      ) : null}
      {action?.kind === 'delete' ? (
        <DeletePaymentDialog open onClose={() => setAction(null)} payment={action.payment} />
      ) : null}
    </div>
  );
}
