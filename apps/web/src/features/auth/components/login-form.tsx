import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { loginSchema } from '../schemas';
import { useSignIn } from '../queries';

interface FieldErrors {
  identifier?: string;
  password?: string;
  form?: string;
}

export function LoginForm() {
  const { t } = useTranslation();
  const signIn = useSignIn();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = loginSchema.safeParse({ identifier, password });

    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ identifier: fields.identifier?.[0], password: fields.password?.[0] });
      return;
    }

    setErrors({});
    signIn.mutate(parsed.data, {
      onError: (error) => setErrors({ form: mapError(error) }),
    });
  }

  const submitting = signIn.isPending;

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="identifier" className="text-sm font-semibold text-ink-900">
          {t('auth.identifierLabel')}
        </label>
        <div className="relative flex items-center">
          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-ink-400">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M14 10h4M14 14h4M6.5 16c.8-.9 1.6-1.3 2.5-1.3s1.7.4 2.5 1.3" />
            </svg>
          </span>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            dir="ltr"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder={t('auth.identifierPlaceholder')}
            aria-invalid={Boolean(errors.identifier)}
            aria-describedby={errors.identifier ? 'identifier-error' : undefined}
            className="h-12 w-full rounded-lg border border-line bg-surface ps-12 pe-4 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        {errors.identifier ? (
          <p id="identifier-error" className="text-sm text-danger-600">
            {t(errors.identifier)}
          </p>
        ) : (
          <p className="text-xs text-ink-400">{t('auth.identifierHint')}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-semibold text-ink-900">
          {t('auth.passwordLabel')}
        </label>
        <div className="relative flex items-center">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            dir="ltr"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t('auth.passwordPlaceholder')}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            className="h-12 w-full rounded-lg border border-line bg-surface ps-4 pe-12 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
            className="absolute inset-y-0 end-0 flex items-center pe-4 text-ink-400 hover:text-ink-900"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
              <circle cx="12" cy="12" r="2.5" />
            </svg>
          </button>
        </div>
        {errors.password ? (
          <p id="password-error" className="text-sm text-danger-600">
            {t(errors.password)}
          </p>
        ) : null}
      </div>

      {errors.form ? (
        <div role="alert" className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-sm text-danger-600">
          {t(errors.form)}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-700 font-semibold text-white transition hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-500/50 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? t('auth.submitting') : t('auth.submit')}
        <svg viewBox="0 0 24 24" className="h-5 w-5 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      <p className="text-center text-xs text-ink-600">{t('auth.help')}</p>
    </form>
  );
}
