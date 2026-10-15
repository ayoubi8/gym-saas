import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n, { changeLanguage, isAppLang, type AppLang } from '../i18n';
import { formatCurrency } from '../lib/format';
import { mapError } from '../lib/pg-errors';
import { useSession } from '../features/auth/queries';
import {
  useCompleteOnboarding,
  useGymPlans,
  useGymSettings,
  useQuickCreatePlan,
} from '../features/onboarding/queries';
import { QUICK_PLAN_TYPES, quickPlanSchema, type QuickPlanType } from '../features/onboarding/schemas';

const STEP_KEYS = ['onboarding.stepLanguage', 'onboarding.stepPlans', 'onboarding.stepImport'] as const;

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useSession();
  const gymId = session?.gym?.id ?? undefined;
  const userId = session?.profile.id ?? '';

  const settings = useGymSettings(gymId);
  const plans = useGymPlans(gymId);
  const createPlan = useQuickCreatePlan(gymId ?? '');
  const complete = useCompleteOnboarding();

  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState<AppLang>(isAppLang(i18n.language) ? i18n.language : 'fr');
  const [planForm, setPlanForm] = useState({ name: '', type: 'monthly' as QuickPlanType, price_dzd: '' });
  const [planError, setPlanError] = useState<string | null>(null);

  const progress = useMemo(() => ((step + 1) / STEP_KEYS.length) * 100, [step]);

  function selectLanguage(next: AppLang) {
    setLanguage(next);
    void changeLanguage(next);
  }

  function handleAddPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = quickPlanSchema.safeParse(planForm);
    if (!parsed.success) {
      setPlanError(parsed.error.flatten().fieldErrors.name?.[0] ?? parsed.error.flatten().fieldErrors.price_dzd?.[0] ?? 'errors.unknown');
      return;
    }
    setPlanError(null);
    createPlan.mutate(parsed.data, {
      onSuccess: () => setPlanForm({ name: '', type: 'monthly', price_dzd: '' }),
      onError: (error) => setPlanError(mapError(error)),
    });
  }

  function finish() {
    if (!gymId) return;
    complete.mutate(
      { gymId, userId, settings: settings.data ?? null, language },
      { onSuccess: () => navigate('/', { replace: true }) },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">{t('onboarding.title')}</h1>
        <p className="text-sm text-ink-600">
          {session?.gym ? <bdi>{session.gym.name}</bdi> : t('onboarding.subtitle')}
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between text-xs text-ink-600">
          <span>{t(STEP_KEYS[step])}</span>
          <span>{t('onboarding.stepOf', { current: step + 1, total: STEP_KEYS.length })}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4 shadow-sm sm:p-6">
        {step === 0 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-ink-900">{t('onboarding.stepLanguage')}</h2>
            <p className="text-sm text-ink-600">{t('onboarding.stepLanguageHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {(['fr', 'ar'] as AppLang[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => selectLanguage(lang)}
                  aria-pressed={language === lang}
                  className={[
                    'h-12 flex-1 rounded-lg border text-sm font-semibold transition',
                    language === lang
                      ? 'border-brand-500 bg-brand-100 text-brand-700'
                      : 'border-line bg-surface text-ink-900 hover:bg-surface-2',
                  ].join(' ')}
                >
                  {lang === 'ar' ? t('common.arabic') : t('common.french')}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="font-bold text-ink-900">{t('onboarding.stepPlans')}</h2>
              <p className="text-sm text-ink-600">{t('onboarding.stepPlansHint')}</p>
            </div>

            {plans.data && plans.data.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {plans.data.map((plan) => (
                  <li key={plan.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">
                    <span className="font-semibold text-ink-900"><bdi>{plan.name}</bdi></span>
                    <span className="text-ink-600">
                      {formatCurrency(plan.price_dzd, language)} · {t(`planType.${plan.type}`)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-600">{t('onboarding.plansEmpty')}</p>
            )}

            <form className="grid grid-cols-1 gap-3 sm:grid-cols-3" onSubmit={handleAddPlan} noValidate>
              <label className="flex flex-col gap-1.5 sm:col-span-1">
                <span className="text-sm font-semibold text-ink-900">{t('onboarding.planName')}</span>
                <input
                  value={planForm.name}
                  onChange={(event) => setPlanForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder={t('onboarding.planNamePlaceholder')}
                  className="h-11 rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">{t('onboarding.planType')}</span>
                <select
                  value={planForm.type}
                  onChange={(event) => setPlanForm((previous) => ({ ...previous, type: event.target.value as QuickPlanType }))}
                  className="h-11 rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                >
                  {QUICK_PLAN_TYPES.map((type) => (
                    <option key={type} value={type}>{t(`planType.${type}`)}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">{t('onboarding.planPrice')}</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  dir="ltr"
                  value={planForm.price_dzd}
                  onChange={(event) => setPlanForm((previous) => ({ ...previous, price_dzd: event.target.value }))}
                  className="h-11 rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
                />
              </label>
              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={createPlan.isPending}
                  className="h-11 rounded-lg border border-brand-500 bg-brand-100 px-4 text-sm font-semibold text-brand-700 transition hover:bg-brand-100/70 disabled:opacity-70"
                >
                  {createPlan.isPending ? t('common.loading') : t('onboarding.addPlan')}
                </button>
              </div>
            </form>

            {planError ? <p role="alert" className="text-sm text-danger-600">{t(planError)}</p> : null}
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-bold text-ink-900">{t('onboarding.stepImport')}</h2>
            <p className="text-sm text-ink-600">{t('onboarding.stepImportHint')}</p>
            <Link
              to="/import"
              className="flex h-11 w-fit items-center rounded-lg border border-line px-4 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {t('onboarding.importCta')}
            </Link>
          </section>
        ) : null}
      </div>

      {complete.isError ? (
        <p role="alert" className="text-sm text-danger-600">{t(mapError(complete.error))}</p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setStep((value) => Math.max(0, value - 1))}
          disabled={step === 0}
          className="h-11 rounded-lg border border-line px-4 text-sm font-semibold text-ink-900 transition hover:bg-surface-2 disabled:opacity-50"
        >
          {t('common.back')}
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={finish}
            disabled={complete.isPending}
            className="h-11 rounded-lg px-4 text-sm font-semibold text-ink-600 transition hover:bg-surface-2 disabled:opacity-50"
          >
            {t('common.skip')}
          </button>
          {step < STEP_KEYS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((value) => Math.min(STEP_KEYS.length - 1, value + 1))}
              className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-900"
            >
              {t('common.next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={complete.isPending}
              className="h-11 rounded-lg bg-brand-700 px-4 text-sm font-semibold text-white transition hover:bg-brand-900 disabled:opacity-70"
            >
              {complete.isPending ? t('common.loading') : t('common.finish')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
