import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatCurrency, formatDate } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { formatDzPhoneForDisplay } from '../lib/phone';
import { useSession } from '../features/auth/queries';
import { useMember } from '../features/members/queries';
import { StatusChip } from '../features/members/components/status-chip';
import {
  AssignDialog,
  ExtendDialog,
  FreezeDialog,
  RenewDialog,
  ResumeDialog,
} from '../features/subscriptions/components/dialogs';
import { useDeductSession } from '../features/subscriptions/queries';

type DialogKind = 'assign' | 'renew' | 'freeze' | 'extend' | 'resume' | null;

export function MemberProfilePage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const lang = useFormatLang();
  const { session } = useSession();
  const gymId = session?.gym?.id ?? '';
  const member = useMember(id);
  const deductSession = useDeductSession(gymId);
  const [dialog, setDialog] = useState<DialogKind>(null);

  if (member.isPending) {
    return <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">{t('common.loading')}</p>;
  }

  if (member.isError || !member.data) {
    return (
      <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
        {member.isError ? t(mapError(member.error)) : t('errors.memberNotFound')}
      </p>
    );
  }

  const { member: profile, status, currentSubscription, owing, payments, pauses } = member.data;
  const paid = currentSubscription
    ? payments
        .filter((payment) => payment.subscription_id === currentSubscription.id)
        .reduce((total, payment) => total + payment.amount_dzd, 0)
    : 0;
  const remaining = currentSubscription ? currentSubscription.price_dzd - paid : 0;
  const openPause = pauses.find(
    (pause) => pause.subscription_id === currentSubscription?.id && pause.resumed_on === null,
  );
  const isSessionPlan =
    currentSubscription?.plan_type_snapshot === 'per_session' ||
    currentSubscription?.plan_type_snapshot === 'class_pack';
  const canDeduct =
    isSessionPlan && (currentSubscription?.sessions_remaining ?? 0) > 0 && !openPause;

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Link to="/members" className="text-sm font-semibold text-brand-700">
        ← {t('members.title')}
      </Link>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="truncate text-lg font-bold text-ink-900">
            <bdi>{profile.full_name}</bdi>
          </h1>
          <StatusChip status={status} />
        </div>
        <p dir="ltr" className="mt-1 text-sm text-ink-600">
          {formatDzPhoneForDisplay(profile.phone)}
        </p>
        {owing > 0 ? (
          <p className="mt-2 rounded-lg bg-danger-100/60 px-3 py-2 text-sm font-semibold text-danger-600">
            {t('members.owingAmount', { amount: formatCurrency(owing, lang) })}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to={`/members/${profile.id}/edit`}
            className="h-9 rounded-lg border border-line px-3 text-sm font-semibold leading-9 text-ink-900 transition hover:bg-surface-2"
          >
            {t('common.edit')}
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
        <h2 className="font-bold text-ink-900">{t('subscriptions.current')}</h2>
        {currentSubscription ? (
          <>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex flex-col">
                <dt className="text-xs text-ink-600">{t('subscriptions.plan')}</dt>
                <dd className="font-semibold text-ink-900">
                  <bdi>{currentSubscription.plan_name_snapshot}</bdi>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-ink-600">{t('subscriptions.type')}</dt>
                <dd className="font-semibold text-ink-900">
                  {t(`planType.${currentSubscription.plan_type_snapshot}`)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-ink-600">{t('subscriptions.start')}</dt>
                <dd className="font-semibold text-ink-900">
                  {formatDate(currentSubscription.start_date, lang)}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-xs text-ink-600">{t('subscriptions.end')}</dt>
                <dd className="font-semibold text-ink-900">
                  {currentSubscription.end_date ? formatDate(currentSubscription.end_date, lang) : '—'}
                </dd>
              </div>
              {isSessionPlan ? (
                <div className="flex flex-col">
                  <dt className="text-xs text-ink-600">{t('subscriptions.sessionsLeft')}</dt>
                  <dd className="font-semibold text-ink-900">{currentSubscription.sessions_remaining ?? 0}</dd>
                </div>
              ) : null}
              <div className="flex flex-col">
                <dt className="text-xs text-ink-600">{t('subscriptions.balance')}</dt>
                <dd className="font-semibold text-ink-900">
                  {formatCurrency(paid, lang)} / {formatCurrency(currentSubscription.price_dzd, lang)}
                  {remaining > 0 ? (
                    <span className="ms-1 text-danger-600">
                      ({t('subscriptions.remaining', { amount: formatCurrency(remaining, lang) })})
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDialog('renew')}
                className="h-10 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white transition hover:bg-brand-900"
              >
                {t('subscriptions.renew')}
              </button>
              {status === 'active' ? (
                <button
                  type="button"
                  onClick={() => setDialog('freeze')}
                  className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
                >
                  {t('subscriptions.freeze')}
                </button>
              ) : null}
              {openPause ? (
                <button
                  type="button"
                  onClick={() => setDialog('resume')}
                  className="h-10 rounded-lg border border-warn-600 px-3 text-sm font-semibold text-warn-600 transition hover:bg-warn-100"
                >
                  {t('subscriptions.resume')}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setDialog('extend')}
                className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
              >
                {t('subscriptions.extend')}
              </button>
              {canDeduct ? (
                <button
                  type="button"
                  disabled={deductSession.isPending}
                  onClick={() =>
                    currentSubscription &&
                    deductSession.mutate({ memberId: profile.id, subscriptionId: currentSubscription.id })
                  }
                  className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2 disabled:opacity-60"
                >
                  {t('subscriptions.recordSession')}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-600">{t('members.noSubscription')}</p>
            <button
              type="button"
              onClick={() => setDialog('assign')}
              className="h-10 w-fit rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white transition hover:bg-brand-900"
            >
              {t('subscriptions.assign')}
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-bold text-ink-900">{t('payments.history')}</h2>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
            {t('payments.empty')}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 text-sm"
              >
                <div className="flex flex-col">
                  <span className="font-semibold text-ink-900">{formatDate(payment.paid_on, lang)}</span>
                  <span className="text-xs text-ink-600">
                    {t(`paymentMethod.${payment.method}`)}
                    {payment.receipt_no ? ` · #${payment.receipt_no}` : ''}
                  </span>
                </div>
                <span className="font-semibold text-brand-700">
                  {formatCurrency(payment.amount_dzd, lang)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {pauses.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-bold text-ink-900">{t('subscriptions.pauseHistory')}</h2>
          <div className="flex flex-col gap-2">
            {pauses.map((pause) => (
              <div key={pause.id} className="rounded-xl border border-line bg-surface p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink-900">{t(`pauseReason.${pause.reason}`)}</span>
                  <span className="text-xs text-ink-600">
                    {formatDate(pause.start_date, lang)}
                    {pause.resumed_on ? ` → ${formatDate(pause.resumed_on, lang)}` : ''}
                  </span>
                </div>
                {pause.days_added !== null ? (
                  <p className="text-xs text-ink-600">{t('subscriptions.daysAdded', { count: pause.days_added })}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <AssignDialog open={dialog === 'assign'} onClose={() => setDialog(null)} memberId={profile.id} />
      <RenewDialog
        open={dialog === 'renew'}
        onClose={() => setDialog(null)}
        memberId={profile.id}
        currentEndDate={currentSubscription?.end_date ?? null}
      />
      {currentSubscription ? (
        <>
          <FreezeDialog
            open={dialog === 'freeze'}
            onClose={() => setDialog(null)}
            memberId={profile.id}
            subscriptionId={currentSubscription.id}
          />
          <ExtendDialog
            open={dialog === 'extend'}
            onClose={() => setDialog(null)}
            memberId={profile.id}
            subscriptionId={currentSubscription.id}
          />
        </>
      ) : null}
      {openPause ? (
        <ResumeDialog
          open={dialog === 'resume'}
          onClose={() => setDialog(null)}
          memberId={profile.id}
          pauseId={openPause.id}
        />
      ) : null}
    </div>
  );
}
