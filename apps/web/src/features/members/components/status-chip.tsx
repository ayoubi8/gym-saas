import { useTranslation } from 'react-i18next';
import type { MemberStatus } from '../../../lib/database.types';

const STATUS_CLASS: Record<MemberStatus, string> = {
  active: 'bg-brand-100 text-brand-700',
  expired: 'bg-danger-100 text-danger-600',
  frozen: 'bg-warn-100 text-warn-600',
};

export function StatusChip({ status }: { status: MemberStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {t(`status.${status}`)}
    </span>
  );
}
