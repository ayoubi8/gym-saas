import { useTranslation } from 'react-i18next';
import { changeLanguage, type AppLang } from '../../../i18n';

const LANG_ORDER: AppLang[] = ['ar', 'fr'];

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'fr') as AppLang;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full bg-surface-2 p-1 ${className ?? ''}`}
      role="group"
      aria-label={t('common.language')}
    >
      {LANG_ORDER.map((lang) => {
        const active = current === lang;
        const label = lang === 'ar' ? t('common.arabic') : t('common.french');
        return (
          <button
            key={lang}
            type="button"
            lang={lang}
            onClick={() => {
              void changeLanguage(lang);
            }}
            aria-pressed={active}
            className={`h-8 rounded-full px-3 text-sm font-semibold transition ${
              active
                ? 'bg-surface text-brand-700 shadow-sm'
                : 'text-ink-600 hover:text-ink-900'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
