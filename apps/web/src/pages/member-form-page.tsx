import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import { formatCurrency } from '../lib/format';
import { useFormatLang } from '../lib/use-format';
import { todayIso } from '../lib/status';
import type { Enums } from '../lib/database.types';
import { useSession } from '../features/auth/queries';
import { useGymPlans } from '../features/onboarding/queries';
import { memberSchema, LANGUAGES } from '../features/members/schemas';
import { useCreateMember, useMember, useUpdateMember } from '../features/members/queries';
import { assignSchema } from '../features/subscriptions/schemas';
import { useAssignSubscription } from '../features/subscriptions/queries';
import { PAYMENT_METHODS } from '../features/subscriptions/schemas';

const inputClass =
  'h-11 w-full rounded-lg border border-line bg-surface px-3 text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

type FieldErrors = Partial<Record<'full_name' | 'phone' | 'form', string>>;

export function MemberFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { session } = useSession();
  const gymId = session?.gym?.id ?? '';
  const lang = useFormatLang();

  const member = useMember(id);
  const plans = useGymPlans(gymId);
  const createMember = useCreateMember(gymId);
  const updateMember = useUpdateMember(id ?? '');
  const assign = useAssignSubscription(gymId);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState<'' | Enums<'lang'>>('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (isEdit && member.data) {
      setFullName(member.data.member.full_name);
      setPhone(member.data.member.phone);
      setLanguage(member.data.member.language ?? '');
    }
  }, [isEdit, member.data]);

  useEffect(() => {
    if (!isEdit && plans.data && plans.data.length > 0 && !planId) {
      setPlanId(plans.data[0].id);
    }
  }, [isEdit, plans.data, planId]);

  const pending = createMember.isPending || updateMember.isPending || assign.isPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = memberSchema.safeParse({
      full_name: fullName,
      phone,
      language: language || undefined,
    });
    if (!parsed.success) {
      const fields = parsed.error.flatten().fieldErrors;
      setErrors({ full_name: fields.full_name?.[0], phone: fields.phone?.[0] });
      return;
    }
    setErrors({});

    try {
      if (isEdit && id) {
        await updateMember.mutateAsync(parsed.data);
        navigate(`/members/${id}`);
        return;
      }

      const newId = crypto.randomUUID();
      await createMember.mutateAsync({ id: newId, input: parsed.data });

      if (planId) {
        const assignment = assignSchema.safeParse({
          plan_id: planId,
          start_date: startDate,
          payment_amount: paymentAmount,
          payment_method: paymentMethod,
        });
        if (assignment.success) {
          await assign.mutateAsync({ memberId: newId, input: assignment.data });
        }
      }
      navigate(`/members/${newId}`);
    } catch (error) {
      setErrors({ form: mapError(error) });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link to={isEdit && id ? `/members/${id}` : '/members'} className="text-sm font-semibold text-brand-700">
          ← {t('common.back')}
        </Link>
      </div>
      <h1 className="text-xl font-bold text-ink-900">
        {isEdit ? t('members.editTitle') : t('members.addTitle')}
      </h1>

      <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="member-name" className="text-sm font-semibold text-ink-900">
            {t('members.fullName')}
          </label>
          <input
            id="member-name"
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder={t('members.fullNamePlaceholder')}
            aria-invalid={Boolean(errors.full_name)}
          />
          {errors.full_name ? <p className="text-sm text-danger-600">{t(errors.full_name)}</p> : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="member-phone" className="text-sm font-semibold text-ink-900">
              {t('members.phone')}
            </label>
            <input
              id="member-phone"
              dir="ltr"
              inputMode="tel"
              className={inputClass}
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t('members.phonePlaceholder')}
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone ? <p className="text-sm text-danger-600">{t(errors.phone)}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="member-language" className="text-sm font-semibold text-ink-900">
              {t('members.language')}
            </label>
            <select
              id="member-language"
              className={inputClass}
              value={language}
              onChange={(event) => setLanguage(event.target.value as '' | Enums<'lang'>)}
            >
              <option value="">{t('members.languageDefault')}</option>
              {LANGUAGES.map((option) => (
                <option key={option} value={option}>
                  {option === 'ar' ? t('common.arabic') : t('common.french')}
                </option>
              ))}
            </select>
          </div>
        </div>

        {!isEdit ? (
          <fieldset className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4">
            <legend className="px-1 text-sm font-semibold text-ink-900">{t('members.firstSubscription')}</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-ink-900">{t('subscriptions.plan')}</span>
                <select
                  className={inputClass}
                  value={planId}
                  onChange={(event) => setPlanId(event.target.value)}
                >
                  <option value="">{t('members.noPlan')}</option>
                  {plans.data?.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.price_dzd, lang)}
                    </option>
                  ))}
                </select>
              </label>

              {planId ? (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink-900">{t('subscriptions.startDate')}</span>
                    <input
                      type="date"
                      dir="ltr"
                      className={inputClass}
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink-900">{t('subscriptions.paymentAmount')}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      dir="ltr"
                      className={inputClass}
                      value={paymentAmount}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                      placeholder={t('subscriptions.paymentOptional')}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink-900">{t('subscriptions.paymentMethod')}</span>
                    <select
                      className={inputClass}
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    >
                      {PAYMENT_METHODS.map((option) => (
                        <option key={option} value={option}>
                          {t(`paymentMethod.${option}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
            </div>
          </fieldset>
        ) : null}

        {errors.form ? (
          <div role="alert" className="rounded-lg border border-danger-100 bg-danger-100/60 px-3 py-2 text-sm text-danger-600">
            {t(errors.form)}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="h-11 rounded-lg border border-line px-4 font-semibold text-ink-900 transition hover:bg-surface-2"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? t('common.saving') : t('members.save')}
          </button>
        </div>
      </form>
    </div>
  );
}
