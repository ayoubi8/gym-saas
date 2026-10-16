import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatCurrency, formatDate, formatDateTime } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { todayIso } from '../lib/status';
import { useOnlineStatus } from '../lib/online';
import { useSession } from '../features/auth/queries';
import { useGymSettings } from '../features/onboarding/queries';
import { useDashboardSummary, useExpiringPreview, useOwingPreview } from '../features/dashboard/queries';
import { DASHBOARD_LINKS, daysUntil } from '../features/dashboard/schemas';
import { HomePage } from './home-page';

interface KpiCardProps {
  label: string;
  value: string;
  hint?: string;
  to: string;
  tone?: 'default' | 'danger' | 'warn';
}

function KpiCard({ label, value, hint, to, tone = 'default' }: KpiCardProps) {
  const valueTone =
    tone === 'danger' ? 'text-danger-600' : tone === 'warn' ? 'text-warn-600' : 'text-ink-900';
  return (
    <Link
      to={to}
      className="flex min-h-[110px] flex-col justify-between rounded-xl border border-line bg-surface p-3.5 shadow-sm transition active:scale-[0.98] hover:border-brand-500"
    >
      <span className="text-xs font-semibold text-ink-600">{label}</span>
      <span className={`mt-2 block text-2xl font-extrabold leading-none ${valueTone}`}>{value}</span>
      {hint ? <span className="mt-1 text-xs text-ink-600">{hint}</span> : null}
    </Link>
  );
}

export function DashboardPage() {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const online = useOnlineStatus();
  const { session } = useSession();
  const isOwner = session?.profile.role === 'owner';
  const gymId = session?.gym?.id;

  const summary = useDashboardSummary(isOwner ? gymId : undefined);
  const expiring = useExpiringPreview(isOwner);
  const owing = useOwingPreview(isOwner);
  const settings = useGymSettings(isOwner ? gymId : undefined);

  if (!isOwner) {
    return <HomePage />;
  }

  const showOnboardingCta =
    settings.isSuccess && settings.data !== null && !settings.data.onboarding_completed;

  if (summary.isError) {
    return (
      <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
        {t(mapError(summary.error))}
      </p>
    );
  }

  const data = summary.data;
  const updatedAt = summary.dataUpdatedAt;

  return (
    <div className="flex flex-col gap-5 pb-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-ink-900">
            <bdi>{session?.gym?.name ?? ''}</bdi>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-ink-600">
            <span
              className={`h-2 w-2 rounded-full ${online ? 'bg-success-600' : 'bg-warn-600'}`}
              aria-hidden="true"
            />
            {online ? t('shell.online') : t('shell.offline')}
          </span>
        </div>
        <h1 className="text-xl font-bold text-ink-900">
          {t('dashboard.greeting', { name: session?.profile.full_name ?? '' })}
        </h1>
        <span className="text-xs text-ink-600">
          {online
            ? t('dashboard.lastSyncedNow')
            : t('dashboard.lastSyncedAt', { time: formatDateTime(new Date(updatedAt), lang) })}
        </span>
      </header>

      {showOnboardingCta ? (
        <Link
          to="/onboarding"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-100/50 p-4 transition hover:bg-brand-100"
        >
          <span>
            <span className="block font-semibold text-brand-700">{t('onboarding.ctaTitle')}</span>
            <span className="block text-sm text-ink-600">{t('onboarding.ctaBody')}</span>
          </span>
          <span className="text-brand-700 rtl:rotate-180" aria-hidden="true">→</span>
        </Link>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <KpiCard
          label={t('dashboard.activeMembers')}
          value={data ? String(data.active_count) : '—'}
          to={DASHBOARD_LINKS.activeMembers}
        />
        <KpiCard
          label={t('dashboard.revenue')}
          value={data ? formatCurrency(data.revenue_today, lang) : '—'}
          hint={data ? t('dashboard.month', { amount: formatCurrency(data.revenue_month, lang) }) : undefined}
          to="/payments"
        />
        <KpiCard
          label={t('dashboard.expiring')}
          value={data ? String(data.expiring_week_count) : '—'}
          hint={t('dashboard.next7Days')}
          tone="warn"
          to={DASHBOARD_LINKS.activeMembers}
        />
        <KpiCard
          label={t('dashboard.unpaid')}
          value={data ? formatCurrency(data.unpaid_total, lang) : '—'}
          hint={data ? t('dashboard.unpaidCount', { count: data.unpaid_member_count }) : undefined}
          tone="danger"
          to={DASHBOARD_LINKS.unpaid}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-600">
          {t('dashboard.quickActions')}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <Link
            to="/members/new"
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-900 shadow-sm transition hover:border-brand-500"
          >
            <span aria-hidden="true">＋</span>
            {t('dashboard.quickAdd')}
          </Link>
          <Link
            to="/payments"
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-900 shadow-sm transition hover:border-brand-500"
          >
            <span aria-hidden="true">₨</span>
            {t('dashboard.quickCollect')}
          </Link>
          <Link
            to="/payments"
            className="flex h-16 flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface text-xs font-semibold text-ink-900 shadow-sm transition hover:border-brand-500"
          >
            <span aria-hidden="true">↻</span>
            {t('dashboard.quickRenew')}
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink-900">{t('dashboard.expiringSection')}</h2>
          <Link to={DASHBOARD_LINKS.activeMembers} className="text-sm font-semibold text-brand-700 hover:underline">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {expiring.isPending ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">{t('common.loading')}</p>
        ) : (expiring.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">{t('dashboard.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(expiring.data ?? []).map((row) => {
              const days = daysUntil(row.end_date, todayIso());
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm"
                >
                  <Link to={`/members/${row.id}`} className="flex min-w-0 flex-col hover:underline">
                    <span className="truncate font-semibold text-ink-900">
                      <bdi>{row.full_name || '—'}</bdi>
                    </span>
                    <span className="truncate text-xs text-ink-600">
                      {row.plan_name ? <bdi>{row.plan_name}</bdi> : ''} · {formatDate(row.end_date, lang)}
                    </span>
                  </Link>
                  <span className="shrink-0 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-bold text-warn-600">
                    {days <= 0 ? t('dashboard.expiresToday') : t('dashboard.inDays', { count: days })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-ink-900">{t('dashboard.owingSection')}</h2>
          <Link to={DASHBOARD_LINKS.unpaid} className="text-sm font-semibold text-brand-700 hover:underline">
            {t('dashboard.viewAll')}
          </Link>
        </div>
        {owing.isPending ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">{t('common.loading')}</p>
        ) : (owing.data ?? []).length === 0 ? (
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">{t('dashboard.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {(owing.data ?? []).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm"
              >
                <Link to={`/members/${row.id}`} className="flex min-w-0 flex-col hover:underline">
                  <span className="truncate font-semibold text-ink-900">
                    <bdi>{row.full_name || '—'}</bdi>
                  </span>
                </Link>
                <span className="shrink-0 rounded-full bg-danger-100 px-2 py-0.5 text-xs font-bold text-danger-600">
                  {t('dashboard.owingAmount', { amount: formatCurrency(row.owing, lang) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
