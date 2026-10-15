import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { createGymSchema, generateTempPassword } from '../schemas';
import { useCreateGym } from '../queries';
import type { CreateGymResult } from '../api';
import { Modal } from './modal';

interface CreateGymDialogProps {
  open: boolean;
  onClose: () => void;
}

type Lang = 'ar' | 'fr';

interface FormState {
  name: string;
  city: string;
  default_language: Lang;
  owner_full_name: string;
  owner_phone_or_email: string;
  password: string;
}

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

const EMPTY_FORM = (): FormState => ({
  name: '',
  city: '',
  default_language: 'ar',
  owner_full_name: '',
  owner_phone_or_email: '',
  password: generateTempPassword(),
});

export function CreateGymDialog({ open, onClose }: CreateGymDialogProps) {
  const { t } = useTranslation();
  const createGym = useCreateGym();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<CreateGymResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM());
      setErrors({});
      setResult(null);
      setCopied(false);
    }
  }, [open]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = createGymSchema.safeParse(form);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fields.name?.[0],
        city: fields.city?.[0],
        default_language: fields.default_language?.[0],
        owner_full_name: fields.owner_full_name?.[0],
        owner_phone_or_email: fields.owner_phone_or_email?.[0],
        password: fields.password?.[0],
      });
      return;
    }

    setErrors({});
    createGym.mutate(parsed.data, {
      onSuccess: (created) => setResult(created),
      onError: (error) => setErrors({ form: mapError(error) }),
    });
  }

  async function copyCredentials() {
    if (!result) return;
    const text = `${t('admin.loginLabel')}: ${result.login}\n${t('admin.tempPassword')}: ${result.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

  return (
    <Modal open={open} onClose={onClose} title={t('admin.createTitle')}>
      {result ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-brand-100 bg-brand-100/50 p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h3 className="font-bold text-ink-900">{t('admin.successTitle')}</h3>
              <p className="text-sm text-ink-600">{t('admin.successBody')}</p>
            </div>
          </div>

          <dl className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-600">{t('admin.gymName')}</dt>
              <dd className="font-semibold text-ink-900"><bdi>{result.gym_name}</bdi></dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-600">{t('admin.loginLabel')}</dt>
              <dd className="font-mono text-ink-900"><bdi dir="ltr">{result.login}</bdi></dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-600">{t('admin.tempPassword')}</dt>
              <dd className="font-mono font-semibold text-ink-900"><bdi dir="ltr">{result.password}</bdi></dd>
            </div>
          </dl>

          <p className="text-xs text-ink-600">{t('admin.credentialsOnce')}</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={copyCredentials}
              className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {copied ? t('common.copied') : t('common.copy')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900"
            >
              {t('common.close')}
            </button>
          </div>
        </div>
      ) : (
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="gym-name" className="text-sm font-semibold text-ink-900">
                {t('admin.gymName')}
              </label>
              <input
                id="gym-name"
                className={inputClass}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                placeholder={t('admin.gymNamePlaceholder')}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name ? <p className="text-sm text-danger-600">{t(errors.name)}</p> : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="gym-city" className="text-sm font-semibold text-ink-900">
                {t('admin.city')}
              </label>
              <input
                id="gym-city"
                className={inputClass}
                value={form.city}
                onChange={(event) => update('city', event.target.value)}
                placeholder={t('admin.cityPlaceholder')}
              />
            </div>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-sm font-semibold text-ink-900">{t('admin.language')}</legend>
              <div className="flex h-11 items-center gap-4 rounded-lg border border-line px-3">
                {(['fr', 'ar'] as Lang[]).map((lang) => (
                  <label key={lang} className="flex items-center gap-2 text-sm text-ink-900">
                    <input
                      type="radio"
                      name="default_language"
                      value={lang}
                      checked={form.default_language === lang}
                      onChange={() => update('default_language', lang)}
                      className="h-4 w-4 text-brand-700 focus:ring-brand-500"
                    />
                    {lang === 'ar' ? t('common.arabic') : t('common.french')}
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="owner-name" className="text-sm font-semibold text-ink-900">
                {t('admin.ownerName')}
              </label>
              <input
                id="owner-name"
                className={inputClass}
                value={form.owner_full_name}
                onChange={(event) => update('owner_full_name', event.target.value)}
                placeholder={t('admin.ownerNamePlaceholder')}
                aria-invalid={Boolean(errors.owner_full_name)}
              />
              {errors.owner_full_name ? (
                <p className="text-sm text-danger-600">{t(errors.owner_full_name)}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="owner-contact" className="text-sm font-semibold text-ink-900">
                {t('admin.ownerContact')}
              </label>
              <input
                id="owner-contact"
                dir="ltr"
                className={inputClass}
                value={form.owner_phone_or_email}
                onChange={(event) => update('owner_phone_or_email', event.target.value)}
                placeholder={t('admin.ownerContactPlaceholder')}
                aria-invalid={Boolean(errors.owner_phone_or_email)}
              />
              {errors.owner_phone_or_email ? (
                <p className="text-sm text-danger-600">{t(errors.owner_phone_or_email)}</p>
              ) : (
                <p className="text-xs text-ink-600">{t('admin.ownerContactHint')}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="owner-password" className="text-sm font-semibold text-ink-900">
                {t('admin.password')}
              </label>
              <div className="flex gap-2">
                <input
                  id="owner-password"
                  dir="ltr"
                  className={`${inputClass} font-mono`}
                  value={form.password}
                  onChange={(event) => update('password', event.target.value)}
                  aria-invalid={Boolean(errors.password)}
                />
                <button
                  type="button"
                  onClick={() => update('password', generateTempPassword())}
                  className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
                >
                  {t('admin.generate')}
                </button>
              </div>
              {errors.password ? (
                <p className="text-sm text-danger-600">{t(errors.password)}</p>
              ) : (
                <p className="text-xs text-ink-600">{t('admin.passwordHint')}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-surface-2 p-4 text-sm">
            <h3 className="mb-2 font-semibold text-ink-900">{t('admin.summary')}</h3>
            <dl className="flex flex-col gap-1.5 text-ink-600">
              <div className="flex justify-between gap-3">
                <dt>{t('admin.gymName')}</dt>
                <dd className="font-semibold text-ink-900"><bdi>{form.name || '—'}</bdi></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t('admin.city')}</dt>
                <dd className="font-semibold text-ink-900"><bdi>{form.city || '—'}</bdi></dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t('admin.language')}</dt>
                <dd className="font-semibold text-ink-900">
                  {form.default_language === 'ar' ? t('common.arabic') : t('common.french')}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>{t('admin.ownerName')}</dt>
                <dd className="font-semibold text-ink-900"><bdi>{form.owner_full_name || '—'}</bdi></dd>
              </div>
            </dl>
          </div>

          {errors.form ? (
            <div role="alert" className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-sm text-danger-600">
              {t(errors.form)}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createGym.isPending}
              className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {createGym.isPending ? t('admin.creating') : t('admin.submit')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
