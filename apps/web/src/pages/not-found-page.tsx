import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface-2 p-4 text-center">
      <h1 className="text-2xl font-bold text-ink-900">{t('notFound.title')}</h1>
      <Link to="/" className="text-sm font-semibold text-brand-700 underline">
        {t('notFound.backHome')}
      </Link>
    </div>
  );
}
