import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '../features/auth/queries';
import { useGymSettings } from '../features/onboarding/queries';

export function HomePage() {
  const { t } = useTranslation();
  const { session } = useSession();
  const profile = session?.profile;
  const roleLabel = profile?.role === 'admin' ? t('shell.roleAdmin') : t('shell.roleOwner');
  const settings = useGymSettings(session?.gym?.id);
  const showOnboardingCta =
    profile?.role === 'owner' && settings.isSuccess && settings.data !== null && !settings.data.onboarding_completed;

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

      {showOnboardingCta ? (
        <Link
          to="/onboarding"
          className="flex items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-100/50 p-4 transition hover:bg-brand-100"
        >
          <span>
            <span className="block font-semibold text-brand-700">{t('onboarding.ctaTitle')}</span>
            <span className="block text-sm text-ink-600">{t('onboarding.ctaBody')}</span>
          </span>
          <span className="text-brand-700 rtl:rotate-180" aria-hidden="true">→</span>
        </Link>
      ) : null}

      <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
        {t('shell.notice')}
      </p>
    </div>
  );
}
