import { useTranslation } from 'react-i18next';
import type { GymStatus } from '../api';

export function GymStatusChip({ status }: { status: GymStatus }) {
  const { t } = useTranslation();
  const active = status === 'active';

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        active ? 'bg-brand-100 text-brand-700' : 'bg-danger-100 text-danger-600',
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 rounded-full', active ? 'bg-brand-500' : 'bg-danger-600'].join(' ')} />
      {t(active ? 'admin.statusActive' : 'admin.statusSuspended')}
    </span>
  );
}
