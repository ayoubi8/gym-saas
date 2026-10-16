import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatCurrency, formatDate } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { formatDzPhoneForDisplay } from '../lib/phone';
import { useSession } from '../features/auth/queries';
import { useReceipt } from '../features/payments/queries';

export function ReceiptPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const lang = useFormatLang();
  const { session } = useSession();
  const receipt = useReceipt(id);
  const [copied, setCopied] = useState(false);

  if (receipt.isPending) {
    return <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">{t('common.loading')}</p>;
  }

  if (receipt.isError || !receipt.data) {
    return (
      <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
        {receipt.isError ? t(mapError(receipt.error)) : t('payments.notFound')}
      </p>
    );
  }

  const { payment, memberName, memberPhone, planName, price, paid, remaining } = receipt.data;
  const gymName = session?.gym?.name ?? '';

  const shareText = [
    gymName,
    t('payments.receiptTitle'),
    `${t('payments.member')}: ${memberName}`,
    planName ? `${t('subscriptions.plan')}: ${planName}` : null,
    `${t('payments.amount')}: ${formatCurrency(payment.amount_dzd, lang)}`,
    `${t('payments.date')}: ${formatDate(payment.paid_on, lang)}`,
    `${t('payments.remainingAfter')}: ${formatCurrency(remaining, lang)}`,
  ]
    .filter(Boolean)
    .join('\n');

  async function handleShare() {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: t('payments.receiptTitle'), text: shareText });
        return;
      } catch {
        // fall through to clipboard (share cancelled or unsupported)
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch {
      // clipboard unavailable; user can still print
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 pb-20">
      <Link to="/payments" className="text-sm font-semibold text-brand-700 no-print">
        ← {t('payments.title')}
      </Link>

      <article className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <h1 className="text-lg font-bold text-ink-900">{gymName || t('common.appName')}</h1>
            <p className="text-xs text-ink-600">{t('payments.receiptTitle')}</p>
          </div>
          <div className="text-end">
            <p className="text-xs text-ink-600">{t('payments.receiptNo')}</p>
            <p className="font-semibold text-ink-900">{payment.receipt_no ? `#${payment.receipt_no}` : '—'}</p>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col">
            <dt className="text-xs text-ink-600">{t('payments.member')}</dt>
            <dd className="font-semibold text-ink-900">
              <bdi>{memberName || '—'}</bdi>
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs text-ink-600">{t('payments.date')}</dt>
            <dd className="font-semibold text-ink-900">{formatDate(payment.paid_on, lang)}</dd>
          </div>
          {memberPhone ? (
            <div className="flex flex-col">
              <dt className="text-xs text-ink-600">{t('members.phone')}</dt>
              <dd className="font-semibold text-ink-900" dir="ltr">
                {formatDzPhoneForDisplay(memberPhone)}
              </dd>
            </div>
          ) : null}
          {planName ? (
            <div className="flex flex-col">
              <dt className="text-xs text-ink-600">{t('subscriptions.plan')}</dt>
              <dd className="font-semibold text-ink-900">
                <bdi>{planName}</bdi>
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col">
            <dt className="text-xs text-ink-600">{t('payments.method')}</dt>
            <dd className="font-semibold text-ink-900">{t(`paymentMethod.${payment.method}`)}</dd>
          </div>
        </dl>

        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-xs text-ink-600">{t('payments.amount')}</p>
          <p className="text-2xl font-bold text-brand-700">{formatCurrency(payment.amount_dzd, lang)}</p>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-3 text-sm">
          <span className="text-ink-600">
            {price === null ? t('payments.paidTotal') : t('payments.paidOf', { paid: formatCurrency(paid, lang), price: formatCurrency(price, lang) })}
          </span>
          <span className={`font-bold ${remaining > 0 ? 'text-danger-600' : 'text-success-600'}`}>
            {remaining > 0
              ? t('payments.remainingAfter') + ' ' + formatCurrency(remaining, lang)
              : t('payments.settled')}
          </span>
        </div>
      </article>

      <div className="flex flex-col gap-2 no-print sm:flex-row">
        <button
          type="button"
          onClick={handleShare}
          className="h-11 flex-1 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
        >
          {copied ? t('common.copied') : t('payments.share')}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 flex-1 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900"
        >
          {t('payments.print')}
        </button>
      </div>
    </div>
  );
}
