import { useTranslation } from 'react-i18next';
import type { ImportRow } from '../../../lib/database.types';
import { reasonKey, rowStatusKey } from '../schemas';

const STATUS_TONE: Record<string, string> = {
  valid: 'bg-brand-100 text-brand-700',
  imported: 'bg-brand-100 text-brand-700',
  error: 'bg-danger-100 text-danger-600',
  failed: 'bg-danger-100 text-danger-600',
  duplicate: 'bg-warn-100 text-warn-600',
  skipped: 'bg-surface-2 text-ink-600',
};

function cell(row: ImportRow, field: string): string {
  const normalized = (row.normalized ?? {}) as Record<string, unknown>;
  const value = normalized[field];
  return value == null ? '' : String(value);
}

interface RowsTableProps {
  rows: ImportRow[];
  limit?: number;
}

export function RowsTable({ rows, limit = 200 }: RowsTableProps) {
  const { t } = useTranslation();
  const shown = rows.slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-3 text-sm text-ink-600">
        {t('import.noRows')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {shown.map((row) => {
          const reason = reasonKey(row.reason);
          return (
            <li
              key={row.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3 shadow-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-semibold text-ink-900">
                  <bdi>{cell(row, 'full_name') || '—'}</bdi>
                </span>
                <span className="truncate text-xs text-ink-600">
                  <bdi dir="ltr">{cell(row, 'phone') || '—'}</bdi>
                </span>
                {reason ? <span className="text-xs text-danger-600">{t(reason)}</span> : null}
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink-600">
                  {t('import.rowLabel', { no: row.row_no })}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    STATUS_TONE[row.status] ?? 'bg-surface-2 text-ink-600'
                  }`}
                >
                  {t(rowStatusKey(row.status))}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      {rows.length > shown.length ? (
        <p className="text-xs text-ink-600">{t('import.moreRows', { count: rows.length - shown.length })}</p>
      ) : null}
    </div>
  );
}
