import { useTranslation } from 'react-i18next';
import i18n, { isAppLang } from '../../../i18n';
import { formatDate } from '../../../lib/format';
import { mapError } from '../../../lib/pg-errors';
import type { AdminGymOwner, AdminGymRow } from '../api';
import { useSetGymStatus } from '../queries';
import { GymStatusChip } from './gym-status-chip';

interface GymCardProps {
  gym: AdminGymRow;
  onResetPassword: (owner: AdminGymOwner) => void;
}

export function GymCard({ gym, onResetPassword }: GymCardProps) {
  const { t } = useTranslation();
  const setStatus = useSetGymStatus();
  const lang = isAppLang(i18n.language) ? i18n.language : 'fr';
  const suspended = gym.status === 'suspended';

  function toggleStatus() {
    setStatus.mutate({ gymId: gym.id, status: suspended ? 'active' : 'suspended' });
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink-900"><bdi>{gym.name}</bdi></h3>
          <p className="text-sm text-ink-600">
            <bdi>{gym.city ?? t('admin.noCity')}</bdi>
            {' · '}
            {gym.default_language === 'ar' ? t('common.arabic') : t('common.french')}
          </p>
        </div>
        <GymStatusChip status={gym.status} />
      </div>

      <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3 sm:flex-col sm:gap-0">
          <dt className="text-ink-600">{t('admin.ownerName')}</dt>
          <dd className="font-semibold text-ink-900">
            {gym.owner ? <bdi>{gym.owner.full_name}</bdi> : t('admin.noOwner')}
          </dd>
        </div>
        <div className="flex justify-between gap-3 sm:flex-col sm:gap-0">
          <dt className="text-ink-600">{t('admin.ownerContact')}</dt>
          <dd className="font-mono text-ink-900" dir="ltr">
            {gym.owner?.phone ?? gym.owner?.email ?? '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-3 sm:flex-col sm:gap-0">
          <dt className="text-ink-600">{t('admin.createdAt')}</dt>
          <dd className="text-ink-900">{formatDate(gym.created_at, lang)}</dd>
        </div>
        {suspended && gym.suspended_at ? (
          <div className="flex justify-between gap-3 sm:flex-col sm:gap-0">
            <dt className="text-ink-600">{t('admin.suspendedAt')}</dt>
            <dd className="text-danger-600">{formatDate(gym.suspended_at, lang)}</dd>
          </div>
        ) : null}
      </dl>

      {setStatus.isError ? (
        <p role="alert" className="text-sm text-danger-600">{t(mapError(setStatus.error))}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={toggleStatus}
          disabled={setStatus.isPending}
          className={[
            'h-10 rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70',
            suspended
              ? 'bg-brand-700 text-white hover:bg-brand-900'
              : 'border border-danger-100 bg-danger-100/50 text-danger-600 hover:bg-danger-100',
          ].join(' ')}
        >
          {suspended ? t('admin.reactivate') : t('admin.suspend')}
        </button>
        {gym.owner ? (
          <button
            type="button"
            onClick={() => {
              if (gym.owner) onResetPassword(gym.owner);
            }}
            className="h-10 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
          >
            {t('admin.resetPassword')}
          </button>
        ) : null}
      </div>
    </article>
  );
}
