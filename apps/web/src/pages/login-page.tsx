import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '../features/auth/components/login-form';
import { LanguageSwitcher } from '../features/auth/components/language-switcher';
import { homePathForRole, useSession } from '../features/auth/queries';

export function LoginPage() {
  const { t } = useTranslation();
  const { status, session } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-2 text-ink-600">
        {t('common.loading')}
      </div>
    );
  }

  if (session) {
    return <Navigate to={homePathForRole(session.profile.role)} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 p-4">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-xl border border-line bg-surface shadow-sm lg:grid-cols-2">
        <section className="flex flex-col gap-6 p-6 sm:p-8">
          <header className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                  <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11" />
                </svg>
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-lg font-bold text-ink-900">{t('common.appName')}</span>
                <span className="text-xs text-ink-400">{t('common.tagline')}</span>
              </div>
            </div>
            <LanguageSwitcher />
          </header>

          <div className="flex flex-col gap-1.5">
            <span className="w-fit rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              {t('auth.badge')}
            </span>
            <h1 className="text-2xl font-bold text-ink-900">{t('auth.title')}</h1>
            <p className="text-sm text-ink-600">{t('auth.subtitle')}</p>
          </div>

          <LoginForm />

          <p className="text-center text-xs text-ink-400">{t('common.version')}</p>
        </section>

        <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-8 text-white lg:flex">
          <div className="pointer-events-none absolute -top-16 -end-16 h-48 w-48 rounded-full bg-brand-500/20 blur-2xl" />
          <div className="relative z-10 flex flex-col gap-2">
            <span className="text-2xl font-bold tracking-tight">{t('common.appName')}</span>
            <span className="text-sm text-white/70">{t('common.tagline')}</span>
          </div>
          <p className="relative z-10 text-lg font-semibold leading-relaxed text-white/90">
            {t('auth.subtitle')}
          </p>
          <div className="relative z-10 flex items-center gap-2 text-xs text-white/70">
            <span className="h-2 w-2 rounded-full bg-brand-500" />
            {t('common.version')}
          </div>
        </aside>
      </div>
    </div>
  );
}
