import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../../lib/format';
import { useFormatLang } from '../../../lib/use-format';
import type { Plan } from '../../../lib/database.types';

interface PlanCardProps {
  plan: Plan;
  onEdit: (plan: Plan) => void;
  onToggleActive: (plan: Plan) => void;
  busy?: boolean;
}

export function PlanCard({ plan, onEdit, onToggleActive, busy }: PlanCardProps) {
  const { t } = useTranslation();
  const lang = useFormatLang();

  const detail = plan.duration_months
    ? t('plans.months', { count: plan.duration_months })
    : plan.session_count
      ? t('plans.sessions', { count: plan.session_count })
      : '';

  return (
    <article className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex min-w-0 flex-col">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-bold text-ink-900">
            <bdi>{plan.name}</bdi>
          </h3>
          {!plan.active ? (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-ink-600">
              {t('plans.inactive')}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-ink-600">
          {t(`planType.${plan.type}`)}
          {detail ? ` · ${detail}` : ''}
        </p>
        <p className="font-semibold text-brand-700">{formatCurrency(plan.price_dzd, lang)}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-2">
        <button
          type="button"
          onClick={() => onEdit(plan)}
          className="h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink-900 transition hover:bg-surface-2"
        >
          {t('common.edit')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onToggleActive(plan)}
          className="h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink-600 transition hover:bg-surface-2 disabled:opacity-60"
        >
          {plan.active ? t('plans.deactivate') : t('plans.activate')}
        </button>
      </div>
    </article>
  );
}
