import { useTranslation } from 'react-i18next';

export function AdminGymsPage() {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <h1 className="text-xl font-bold text-ink-900">{t('admin.gymsTitle')}</h1>
      <p className="mt-2 text-sm text-ink-600">{t('shell.notice')}</p>
    </div>
  );
}
