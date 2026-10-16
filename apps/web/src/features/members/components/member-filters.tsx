import { useTranslation } from 'react-i18next';
import type { MemberStatus } from '../../../lib/database.types';

export type StatusFilter = 'all' | MemberStatus;

const STATUSES: MemberStatus[] = ['active', 'expired', 'frozen'];

interface MemberFiltersProps {
  status: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
  search: string;
  onSearchChange: (search: string) => void;
  owingOnly: boolean;
  onOwingChange: (value: boolean) => void;
}

export function MemberFilters({
  status,
  onStatusChange,
  search,
  onSearchChange,
  owingOnly,
  onOwingChange,
}: MemberFiltersProps) {
  const { t } = useTranslation();
  const chips: StatusFilter[] = ['all', ...STATUSES];

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={t('members.searchPlaceholder')}
        aria-label={t('members.search')}
        className="h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
      />
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onStatusChange(chip)}
            aria-pressed={status === chip}
            className={`h-9 rounded-full px-3 text-sm font-semibold transition ${
              status === chip
                ? 'bg-brand-700 text-white'
                : 'border border-line bg-surface text-ink-600 hover:bg-surface-2'
            }`}
          >
            {chip === 'all' ? t('members.filterAll') : t(`status.${chip}`)}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-2 text-sm text-ink-600">
          <input
            type="checkbox"
            checked={owingOnly}
            onChange={(event) => onOwingChange(event.target.checked)}
            className="h-4 w-4 rounded border-line text-brand-700 focus:ring-brand-500"
          />
          {t('members.owingOnly')}
        </label>
      </div>
    </div>
  );
}
