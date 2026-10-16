import { useNavigate, Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../features/auth/components/language-switcher';
import { useSession, useSignOut } from '../features/auth/queries';
import { SyncBar } from './sync-bar';

const OWNER_NAV = [
  { to: '/', labelKey: 'nav.home', end: true },
  { to: '/members', labelKey: 'nav.members', end: false },
  { to: '/payments', labelKey: 'nav.payments', end: false },
  { to: '/plans', labelKey: 'nav.plans', end: false },
];

export function AppShell() {
  const { t } = useTranslation();
  const { session } = useSession();
  const signOut = useSignOut();
  const navigate = useNavigate();
  const isOwner = session?.profile.role === 'owner';

  function handleSignOut() {
    signOut.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-brand-900 px-4 py-3 text-white">
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-bold tracking-tight">{t('common.appName')}</span>
          <span className="text-xs text-white/70">{t('common.tagline')}</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={handleSignOut}
            className="h-9 rounded-lg border border-white/30 px-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            {t('common.logout')}
          </button>
        </div>
      </header>

      <SyncBar />

      <main className={`mx-auto w-full max-w-3xl flex-1 px-4 py-6 ${isOwner ? 'pb-24' : ''}`}>
        <Outlet context={session} />
      </main>

      {isOwner ? (
        <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface">
          <div className="mx-auto flex w-full max-w-3xl">
            {OWNER_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold transition ${
                    isActive ? 'text-brand-700' : 'text-ink-600'
                  }`
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
