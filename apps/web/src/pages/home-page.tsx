import { useTranslation } from 'react-i18next';
import { useSession } from '../features/auth/queries';

export function HomePage() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = session?.profile;
  const roleLabel = profile?.role === 'admin' ? t('shell.roleAdmin') : t('shell.roleOwner');

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
        <p className="text-sm text-ink-600">{t('shell.signedInAs')}</p>
        <p className="text-lg font-bold text-ink-900">
          <bdi>{profile?.full_name ?? ''}</bdi>
        </p>
        <p className="text-sm text-ink-600">{roleLabel}</p>
        {session?.gym ? (
          <p className="mt-1 text-sm text-ink-600">
            {t('shell.gym')}: <bdi>{session.gym.name}</bdi>
          </p>
        ) : null}
      </div>

      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
        {t('shell.notice')}
      </p>
    </div>
  );
}
