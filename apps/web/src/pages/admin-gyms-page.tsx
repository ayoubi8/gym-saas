import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { useAdminGyms } from '../features/admin/queries';
import type { AdminGymOwner } from '../features/admin/api';
import { CreateGymDialog } from '../features/admin/components/create-gym-dialog';
import { GymCard } from '../features/admin/components/gym-card';
import { ResetPasswordDialog } from '../features/admin/components/reset-password-dialog';

export function AdminGymsPage() {
  const { t } = useTranslation();
  const gyms = useAdminGyms();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetOwner, setResetOwner] = useState<AdminGymOwner | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t('admin.gymsTitle')}</h1>
          <p className="text-sm text-ink-600">{t('admin.gymsSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900"
        >
          {t('admin.create')}
        </button>
      </div>

      {gyms.isPending ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
          {t('common.loading')}
        </p>
      ) : null}

      {gyms.isError ? (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
          {t(mapError(gyms.error))}
        </p>
      ) : null}

      {gyms.isSuccess && gyms.data.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold text-ink-900">{t('admin.empty')}</p>
          <p className="mt-1 text-sm text-ink-600">{t('admin.emptyHint')}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {gyms.data?.map((gym) => (
          <GymCard key={gym.id} gym={gym} onResetPassword={setResetOwner} />
        ))}
      </div>

      <CreateGymDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {resetOwner ? (
        <ResetPasswordDialog
          open
          owner={resetOwner}
          onClose={() => setResetOwner(null)}
        />
      ) : null}
    </div>
  );
}
