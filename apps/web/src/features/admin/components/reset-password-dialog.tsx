import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { generateTempPassword, resetPasswordSchema } from '../schemas';
import { useResetOwnerPassword } from '../queries';
import type { AdminGymOwner } from '../api';
import { Modal } from './modal';

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  owner: AdminGymOwner;
}

export function ResetPasswordDialog({ open, onClose, owner }: ResetPasswordDialogProps) {
  const { t } = useTranslation();
  const resetPassword = useResetOwnerPassword();
  const [password, setPassword] = useState(generateTempPassword());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword(generateTempPassword());
      setError(null);
      setDone(false);
    }
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resetPasswordSchema.safeParse({ user_id: owner.id, new_password: password });
    if (!parsed.success) {
      setError(parsed.error.flatten().fieldErrors.new_password?.[0] ?? 'errors.unknown');
      return;
    }

    setError(null);
    resetPassword.mutate(parsed.data, {
      onSuccess: () => setDone(true),
      onError: (mutationError) => setError(mapError(mutationError)),
    });
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
    } catch {
      // clipboard unavailable — admin can still read it on screen
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t('admin.resetTitle')}>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <p className="text-sm text-ink-600">
          {t('admin.resetFor')} <span className="font-semibold text-ink-900"><bdi>{owner.full_name}</bdi></span>
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reset-password" className="text-sm font-semibold text-ink-900">
            {t('admin.newPassword')}
          </label>
          <div className="flex gap-2">
            <input
              id="reset-password"
              dir="ltr"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-surface px-3 font-mono text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
            />
            <button
              type="button"
              onClick={() => setPassword(generateTempPassword())}
              className="h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {t('admin.generate')}
            </button>
          </div>
          <p className="text-xs text-ink-600">{t('admin.resetNoEmail')}</p>
        </div>

        {error ? (
          <div role="alert" className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-sm text-danger-600">
            {t(error)}
          </div>
        ) : null}

        {done ? (
          <div className="rounded-lg border border-brand-100 bg-brand-100/50 px-3 py-2 text-sm text-brand-700">
            {t('admin.resetDone')}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {done ? (
            <button
              type="button"
              onClick={copyPassword}
              className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
            >
              {t('common.copy')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
          >
            {t('common.close')}
          </button>
          {!done ? (
            <button
              type="submit"
              disabled={resetPassword.isPending}
              className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {resetPassword.isPending ? t('admin.resetting') : t('admin.resetSubmit')}
            </button>
          ) : null}
        </div>
      </form>
    </Modal>
  );
}
