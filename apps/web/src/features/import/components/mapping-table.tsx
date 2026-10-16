import { useTranslation } from 'react-i18next';
import { REQUIRED_FIELDS, TARGET_FIELDS, type ColumnMapping, type TargetField } from '../schemas';

interface MappingTableProps {
  headers: string[];
  mapping: ColumnMapping;
  onChange: (field: TargetField, header: string) => void;
}

export function MappingTable({ headers, mapping, onChange }: MappingTableProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col divide-y divide-line rounded-xl border border-line bg-surface">
      {TARGET_FIELDS.map((field) => {
        const required = REQUIRED_FIELDS.includes(field);
        const value = mapping[field] ?? '';
        const missing = required && !value;
        return (
          <div key={field} className="flex items-center justify-between gap-3 p-3">
            <label htmlFor={`map-${field}`} className="flex flex-col">
              <span className="text-sm font-semibold text-ink-900">
                {t(`import.fields.${field}`)}
                {required ? <span className="text-danger-600"> *</span> : null}
              </span>
              <span className="text-xs text-ink-600">
                {required ? t('import.fieldRequired') : t('import.fieldOptional')}
              </span>
            </label>
            <select
              id={`map-${field}`}
              value={value}
              onChange={(event) => onChange(field, event.target.value)}
              aria-label={t(`import.fields.${field}`)}
              className={`h-11 min-w-[45%] rounded-lg border bg-surface px-2 text-sm text-ink-900 ${
                missing ? 'border-danger-600' : 'border-line'
              }`}
            >
              <option value="">{t('import.ignoreColumn')}</option>
              {headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
