import { Navigate, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { Enums } from '../../lib/database.types';
import { homePathForRole, useSession } from './queries';

function LoadingScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-2 text-ink-600">
      {t('common.loading')}
    </div>
  );
}

/** Requires an authenticated session; suspended gyms resolve to null upstream. */
export function RequireAuth() {
  const { status, session } = useSession();

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;

  return <Outlet />;
}

/** Requires one of the given roles; otherwise sends the user to their own home. */
export function RequireRole({ roles }: { roles: Enums<'role_type'>[] }) {
  const { status, session } = useSession();

  if (status === 'loading') return <LoadingScreen />;
  if (!session) return <Navigate to="/login" replace />;
  if (!roles.includes(session.profile.role)) {
    return <Navigate to={homePathForRole(session.profile.role)} replace />;
  }

  return <Outlet />;
}
