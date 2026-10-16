import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { useSession } from '../../auth/queries';
import { Modal } from '../../admin/components/modal';
import { planSchema, PLAN_TYPES, isTimePlan, type PlanInput } from '../schemas';
import { useUpsertPlan } from '../queries';
import type { Plan } from '../../../lib/database.types';

interface PlanFormDialogProps {
  open: boolean;
  onClose: () => void;
  plan?: Plan | null;
}

interface FormState {
  name: string;
  type: PlanInput['type'];
  price_dzd: string;
  session_count: string;
  validity_days: string;
}

type FieldErrors = Partial<Record<keyof FormState | 'form', string>>;

const EMPTY_FORM: FormState = {
  name: '',
  type: 'monthly',
  price_dzd: '',
  session_count: '',
  validity_days: '',
};

export function PlanFormDialog({ open, onClose, plan }: PlanFormDialogProps) {
  const { t } = useTranslation();
  const { session } = useSession();
  const gymId = session?.gym?.id ?? '';
  const upsertPlan = useUpsertPlan(gymId);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setErrors({});
    if (plan) {
      setForm({
        name: plan.name,
        type: plan.type,
        price_dzd: String(plan.price_dzd),
        session_count: plan.session_count ? String(plan.session_count) : '',
        validity_days: plan.validity_days ? String(plan.validity_days) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, plan]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = planSchema.safeParse(form);
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fields.name?.[0],
        type: fields.type?.[0],
        price_dzd: fields.price_dzd?.[0],
        session_count: fields.session_count?.[0],
        validity_days: fields.validity_days?.[0],
      });
      return;
    }

    setErrors({});
    upsertPlan.mutate(
      { id: plan?.id, input: parsed.data },
      {
        onSuccess: onClose,
        onError: (error) => setErrors({ form: mapError(error) }),
      },
    );
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';
  const timePlan = isTimePlan(form.type);

  return (
    <Modal open={open} onClose={onClose} title={plan ? t('plans.editTitle') : t('plans.createTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="plan-name" className="text-sm font-semibold text-ink-900">
            {t('plans.name')}
          </label>
          <input
            id="plan-name"
            className={inputClass}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder={t('plans.namePlaceholder')}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <p className="text-sm text-danger-600">{t(errors.name)}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-type" className="text-sm font-semibold text-ink-900">
              {t('plans.type')}
            </label>
            <select
              id="plan-type"
              className={inputClass}
              value={form.type}
              onChange={(event) => update('type', event.target.value as PlanInput['type'])}
            >
              {PLAN_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`planType.${type}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="plan-price" className="text-sm font-semibold text-ink-900">
              {t('plans.price')}
            </label>
            <input
              id="plan-price"
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              className={inputClass}
              value={form.price_dzd}
              onChange={(event) => update('price_dzd', event.target.value)}
              aria-invalid={Boolean(errors.price_dzd)}
            />
            {errors.price_dzd ? (
              <p className="text-sm text-danger-600">{t(errors.price_dzd)}</p>
            ) : null}
          </div>

          {timePlan ? (
            <p className="text-sm text-ink-600 sm:col-span-2">{t('plans.timeHint')}</p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="plan-sessions" className="text-sm font-semibold text-ink-900">
                  {t('plans.sessionCount')}
                </label>
                <input
                  id="plan-sessions"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  dir="ltr"
                  className={inputClass}
                  value={form.session_count}
                  onChange={(event) => update('session_count', event.target.value)}
                  aria-invalid={Boolean(errors.session_count)}
                />
                {errors.session_count ? (
                  <p className="text-sm text-danger-600">{t(errors.session_count)}</p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="plan-validity" className="text-sm font-semibold text-ink-900">
                  {t('plans.validityDays')}
                </label>
                <input
                  id="plan-validity"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  dir="ltr"
                  className={inputClass}
                  value={form.validity_days}
                  onChange={(event) => update('validity_days', event.target.value)}
                />
                <p className="text-xs text-ink-600">{t('plans.validityHint')}</p>
              </div>
            </>
          )}
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
            disabled={upsertPlan.isPending}
            className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {upsertPlan.isPending ? t('common.saving') : t('plans.save')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
