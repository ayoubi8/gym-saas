import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { formatCurrency } from '../../../lib/format';
import { useFormatLang } from '../../../lib/use-format';
import { todayIso } from '../../../lib/status';
import { useSession } from '../../auth/queries';
import { Modal } from '../../admin/components/modal';
import { useGymPlans } from '../../onboarding/queries';
import type { Plan } from '../../../lib/database.types';
import {
  assignSchema,
  extendSchema,
  freezeSchema,
  renewSchema,
  resumeSchema,
  EXTENSION_REASONS,
  PAUSE_REASONS,
  PAYMENT_METHODS,
  type AssignInput,
  type RenewInput,
} from '../schemas';
import {
  useAssignSubscription,
  useExtendSubscription,
  usePauseSubscription,
  useRenewSubscription,
  useResumeSubscription,
} from '../queries';

const inputClass =
  'h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink-900">{label}</span>
      {children}
      {error ? <p className="text-sm text-danger-600">{t(error)}</p> : null}
    </div>
  );
}

function FormError({ code }: { code?: string }) {
  const { t } = useTranslation();
  if (!code) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-sm text-danger-600">
      {t(code)}
    </div>
  );
}

function Actions({ onClick, pending, submitLabel }: { onClick: () => void; pending: boolean; submitLabel: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClick}
        className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
      >
        {t('common.cancel')}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? t('common.saving') : submitLabel}
      </button>
    </div>
  );
}

function useActivePlans() {
  const { session } = useSession();
  const gymId = session?.gym?.id ?? '';
  const plans = useGymPlans(gymId);
  return { gymId, plans };
}

function PlanSelect({
  plans,
  value,
  onChange,
}: {
  plans: Plan[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const lang = useFormatLang();
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} required>
      <option value="" disabled>
        {t('subscriptions.selectPlan')}
      </option>
      {plans.map((plan) => (
        <option key={plan.id} value={plan.id}>
          {plan.name} — {formatCurrency(plan.price_dzd, lang)}
        </option>
      ))}
    </select>
  );
}

function PaymentFields({
  amount,
  method,
  onAmount,
  onMethod,
}: {
  amount: string;
  method: string;
  onAmount: (value: string) => void;
  onMethod: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t('subscriptions.paymentAmount')}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          dir="ltr"
          className={inputClass}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          placeholder={t('subscriptions.paymentOptional')}
        />
      </Field>
      <Field label={t('subscriptions.paymentMethod')}>
        <select className={inputClass} value={method} onChange={(event) => onMethod(event.target.value)}>
          {PAYMENT_METHODS.map((option) => (
            <option key={option} value={option}>
              {t(`paymentMethod.${option}`)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

// ---------------- Assign ----------------

export function AssignDialog({
  open,
  onClose,
  memberId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
}) {
  const { t } = useTranslation();
  const { gymId, plans } = useActivePlans();
  const assign = useAssignSubscription(gymId);
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setPlanId('');
    setStartDate(todayIso());
    setAmount('');
    setMethod('cash');
    setError(undefined);
  }, [open]);

  useEffect(() => {
    if (open && plans.data && plans.data.length > 0 && !planId) {
      setPlanId(plans.data[0].id);
    }
  }, [open, plans.data, planId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = assignSchema.safeParse({
      plan_id: planId,
      start_date: startDate,
      payment_amount: amount,
      payment_method: method,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    assign.mutate(
      { memberId, input: parsed.data as AssignInput },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('subscriptions.assignTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <Field label={t('subscriptions.plan')}>
          <PlanSelect plans={plans.data ?? []} value={planId} onChange={setPlanId} />
        </Field>
        <Field label={t('subscriptions.startDate')}>
          <input
            type="date"
            dir="ltr"
            className={inputClass}
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </Field>
        <PaymentFields amount={amount} method={method} onAmount={setAmount} onMethod={setMethod} />
        <FormError code={error} />
        <Actions onClick={onClose} pending={assign.isPending} submitLabel={t('subscriptions.assign')} />
      </form>
    </Modal>
  );
}

// ---------------- Renew ----------------

export function RenewDialog({
  open,
  onClose,
  memberId,
  currentEndDate,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  currentEndDate?: string | null;
}) {
  const { t } = useTranslation();
  const { gymId, plans } = useActivePlans();
  const renew = useRenewSubscription(gymId);
  const [planId, setPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setPlanId('');
    setAmount('');
    setMethod('cash');
    setError(undefined);
  }, [open]);

  useEffect(() => {
    if (open && plans.data && plans.data.length > 0 && !planId) {
      setPlanId(plans.data[0].id);
    }
  }, [open, plans.data, planId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = renewSchema.safeParse({
      plan_id: planId,
      payment_amount: amount,
      payment_method: method,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    renew.mutate(
      { memberId, input: parsed.data as RenewInput },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('subscriptions.renewTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {currentEndDate ? (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-600">
            {t('subscriptions.renewHint', { date: currentEndDate })}
          </p>
        ) : null}
        <Field label={t('subscriptions.plan')}>
          <PlanSelect plans={plans.data ?? []} value={planId} onChange={setPlanId} />
        </Field>
        <PaymentFields amount={amount} method={method} onAmount={setAmount} onMethod={setMethod} />
        <FormError code={error} />
        <Actions onClick={onClose} pending={renew.isPending} submitLabel={t('subscriptions.renew')} />
      </form>
    </Modal>
  );
}

// ---------------- Freeze (pause) ----------------

export function FreezeDialog({
  open,
  onClose,
  memberId,
  subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  subscriptionId: string;
}) {
  const { t } = useTranslation();
  const { gymId } = useActivePlans();
  const pause = usePauseSubscription(gymId);
  const [startDate, setStartDate] = useState(todayIso());
  const [reason, setReason] = useState<string>('travel');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setStartDate(todayIso());
    setReason('travel');
    setPlannedEnd('');
    setNote('');
    setError(undefined);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = freezeSchema.safeParse({
      start_date: startDate,
      reason,
      planned_end: plannedEnd,
      note,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    pause.mutate(
      { memberId, subscriptionId, input: parsed.data },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('subscriptions.freezeTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('subscriptions.startDate')}>
            <input
              type="date"
              dir="ltr"
              className={inputClass}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </Field>
          <Field label={t('subscriptions.reason')}>
            <select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)}>
              {PAUSE_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(`pauseReason.${option}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('subscriptions.plannedEnd')}>
            <input
              type="date"
              dir="ltr"
              className={inputClass}
              value={plannedEnd}
              onChange={(event) => setPlannedEnd(event.target.value)}
            />
          </Field>
          <Field label={t('subscriptions.note')}>
            <input
              className={inputClass}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
        </div>
        <FormError code={error} />
        <Actions onClick={onClose} pending={pause.isPending} submitLabel={t('subscriptions.freeze')} />
      </form>
    </Modal>
  );
}

// ---------------- Extend ----------------

export function ExtendDialog({
  open,
  onClose,
  memberId,
  subscriptionId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  subscriptionId: string;
}) {
  const { t } = useTranslation();
  const { gymId } = useActivePlans();
  const extend = useExtendSubscription(gymId);
  const [days, setDays] = useState('');
  const [reason, setReason] = useState<string>('compensation');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setDays('');
    setReason('compensation');
    setNote('');
    setError(undefined);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = extendSchema.safeParse({ days, reason, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    extend.mutate(
      { memberId, subscriptionId, input: parsed.data },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('subscriptions.extendTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('subscriptions.days')}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              dir="ltr"
              className={inputClass}
              value={days}
              onChange={(event) => setDays(event.target.value)}
            />
          </Field>
          <Field label={t('subscriptions.reason')}>
            <select className={inputClass} value={reason} onChange={(event) => setReason(event.target.value)}>
              {EXTENSION_REASONS.map((option) => (
                <option key={option} value={option}>
                  {t(`extReason.${option}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('subscriptions.note')}>
            <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        <FormError code={error} />
        <Actions onClick={onClose} pending={extend.isPending} submitLabel={t('subscriptions.extend')} />
      </form>
    </Modal>
  );
}

// ---------------- Resume ----------------

export function ResumeDialog({
  open,
  onClose,
  memberId,
  pauseId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  pauseId: string;
}) {
  const { t } = useTranslation();
  const resume = useResumeSubscription();
  const [resumedOn, setResumedOn] = useState(todayIso());
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setResumedOn(todayIso());
    setError(undefined);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = resumeSchema.safeParse({ resumed_on: resumedOn });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    resume.mutate(
      { memberId, pauseId, input: parsed.data },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('subscriptions.resumeTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <Field label={t('subscriptions.resumeDate')}>
          <input
            type="date"
            dir="ltr"
            className={inputClass}
            value={resumedOn}
            onChange={(event) => setResumedOn(event.target.value)}
          />
        </Field>
        <FormError code={error} />
        <Actions onClick={onClose} pending={resume.isPending} submitLabel={t('subscriptions.resume')} />
      </form>
    </Modal>
  );
}
