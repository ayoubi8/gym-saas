import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../../../lib/pg-errors';
import { formatCurrency } from '../../../lib/format';
import { useFormatLang } from '../../../lib/use-format';
import { useOnlineStatus } from '../../../lib/online';
import { todayIso } from '../../../lib/status';
import { Modal } from '../../admin/components/modal';
import { useMembers } from '../../members/queries';
import type { Payment } from '../../../lib/database.types';
import {
  PAYMENT_METHODS,
  deletePaymentSchema,
  editPaymentSchema,
  recordPaymentSchema,
  type DeletePaymentInput,
  type EditPaymentInput,
  type RecordPaymentInput,
} from '../schemas';
import { useDeletePayment, useEditPayment, useRecordPayment } from '../queries';

const inputClass =
  'h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

const PRESETS = [1000, 2000, 5000, 10000];

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

function MethodSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  return (
    <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>
      {PAYMENT_METHODS.map((option) => (
        <option key={option} value={option}>
          {t(`paymentMethod.${option}`)}
        </option>
      ))}
    </select>
  );
}

// ---------------- Record ----------------

export function RecordPaymentDialog({
  open,
  onClose,
  memberId,
  subscriptionId,
  remaining,
}: {
  open: boolean;
  onClose: () => void;
  memberId?: string;
  subscriptionId?: string;
  /** Price minus already-paid for the subscription; enables the "pay full" action. */
  remaining?: number | null;
}) {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const members = useMembers();
  const record = useRecordPayment();
  const [pickedMemberId, setPickedMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState(todayIso());
  const [method, setMethod] = useState<string>('cash');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string>();

  const selectable = useMemo(
    () => (members.data ?? []).filter((member) => member.subscriptionId),
    [members.data],
  );
  const resolvedMemberId = memberId ?? pickedMemberId;
  const resolvedSubscriptionId =
    subscriptionId ?? selectable.find((member) => member.id === pickedMemberId)?.subscriptionId ?? '';

  useEffect(() => {
    if (!open) return;
    setPickedMemberId('');
    setAmount('');
    setPaidOn(todayIso());
    setMethod('cash');
    setNote('');
    setError(undefined);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolvedSubscriptionId) {
      setError('members.noSubscription');
      return;
    }
    const parsed = recordPaymentSchema.safeParse({ amount_dzd: amount, paid_on: paidOn, method, note });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    record.mutate(
      { memberId: resolvedMemberId, subscriptionId: resolvedSubscriptionId, input: parsed.data as RecordPaymentInput },
      {
        onSuccess: (payment) => {
          onClose();
          navigate(`/payments/${payment.id}/receipt`);
        },
        onError: (e) => setError(mapError(e)),
      },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('payments.recordTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        {subscriptionId ? null : (
          <Field label={t('payments.member')}>
            <select
              className={inputClass}
              value={pickedMemberId}
              onChange={(event) => setPickedMemberId(event.target.value)}
              required
            >
              <option value="" disabled>
                {t('payments.selectMember')}
              </option>
              {selectable.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={t('payments.amount')}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            dir="ltr"
            autoFocus
            className={`${inputClass} h-14 text-center text-2xl font-bold`}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-900 transition hover:bg-surface-2/70"
            >
              {formatCurrency(preset, lang)}
            </button>
          ))}
          {remaining && remaining > 0 ? (
            <button
              type="button"
              onClick={() => setAmount(String(remaining))}
              className="rounded-full bg-brand-100 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100/70"
            >
              {t('payments.payFull', { amount: formatCurrency(remaining, lang) })}
            </button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('payments.date')}>
            <input
              type="date"
              dir="ltr"
              className={inputClass}
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </Field>
          <Field label={t('payments.method')}>
            <MethodSelect value={method} onChange={setMethod} />
          </Field>
        </div>

        <Field label={t('payments.note')}>
          <input
            className={inputClass}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t('payments.notePlaceholder')}
          />
        </Field>

        {!online ? (
          <p className="rounded-lg bg-warn-100/60 px-3 py-2 text-sm text-warn-600">{t('payments.offlineQueued')}</p>
        ) : null}
        <FormError code={error} />
        <Actions onClick={onClose} pending={record.isPending} submitLabel={t('payments.record')} />
      </form>
    </Modal>
  );
}

// ---------------- Edit (reason required) ----------------

export function EditPaymentDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment;
}) {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const edit = useEditPayment();
  const [amount, setAmount] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [method, setMethod] = useState<string>('cash');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setAmount(String(payment.amount_dzd));
    setPaidOn(payment.paid_on);
    setMethod(payment.method);
    setNote(payment.note ?? '');
    setReason('');
    setError(undefined);
  }, [open, payment]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = editPaymentSchema.safeParse({
      amount_dzd: amount,
      paid_on: paidOn,
      method,
      note,
      reason,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    edit.mutate(
      { id: payment.id, memberId: payment.member_id, input: parsed.data as EditPaymentInput },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('payments.editTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t('payments.amount')}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              dir="ltr"
              className={inputClass}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </Field>
          <Field label={t('payments.date')}>
            <input
              type="date"
              dir="ltr"
              className={inputClass}
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
          </Field>
          <Field label={t('payments.method')}>
            <MethodSelect value={method} onChange={setMethod} />
          </Field>
          <Field label={t('payments.note')}>
            <input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </div>
        <Field label={t('payments.reason')}>
          <input
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('payments.reasonPlaceholder')}
            required
          />
        </Field>
        {!online ? (
          <p className="rounded-lg bg-warn-100/60 px-3 py-2 text-sm text-warn-600">
            {t('payments.offlineEditBlocked')}
          </p>
        ) : null}
        <FormError code={error} />
        <Actions onClick={onClose} pending={edit.isPending} submitLabel={t('common.save')} />
      </form>
    </Modal>
  );
}

// ---------------- Delete (reason required) ----------------

export function DeletePaymentDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: Payment;
}) {
  const { t } = useTranslation();
  const lang = useFormatLang();
  const online = useOnlineStatus();
  const remove = useDeletePayment();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(undefined);
  }, [open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = deletePaymentSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'errors.invalidInput');
      return;
    }
    setError(undefined);
    remove.mutate(
      { id: payment.id, memberId: payment.member_id, input: parsed.data as DeletePaymentInput },
      { onSuccess: onClose, onError: (e) => setError(mapError(e)) },
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('payments.deleteTitle')}>
      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-600">
          {t('payments.deleteHint', { amount: formatCurrency(payment.amount_dzd, lang) })}
        </p>
        <Field label={t('payments.reason')}>
          <input
            className={inputClass}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('payments.reasonPlaceholder')}
            required
          />
        </Field>
        {!online ? (
          <p className="rounded-lg bg-warn-100/60 px-3 py-2 text-sm text-warn-600">
            {t('payments.offlineEditBlocked')}
          </p>
        ) : null}
        <FormError code={error} />
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
            disabled={remove.isPending}
            className="h-11 rounded-lg bg-danger-600 px-4 font-semibold text-white transition hover:bg-danger-600/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {remove.isPending ? t('common.saving') : t('common.delete')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
