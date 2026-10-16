import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { mapError } from '../lib/pg-errors';
import type { Plan } from '../lib/database.types';
import { usePlans, useSetPlanActive } from '../features/plans/queries';
import { PlanCard } from '../features/plans/components/plan-card';
import { PlanFormDialog } from '../features/plans/components/plan-form-dialog';

export function PlansPage() {
  const { t } = useTranslation();
  const plans = usePlans();
  const setActive = useSetPlanActive();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setFormOpen(true);
  }

  function toggleActive(plan: Plan) {
    setActive.mutate({ id: plan.id, active: !plan.active });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{t('plans.title')}</h1>
          <p className="text-sm text-ink-600">{t('plans.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="h-11 rounded-lg bg-brand-700 px-4 font-semibold text-white transition hover:bg-brand-900"
        >
          {t('plans.create')}
        </button>
      </div>

      {plans.isPending ? (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-600">
          {t('common.loading')}
        </p>
      ) : null}

      {plans.isError ? (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-100/60 p-4 text-sm text-danger-600">
          {t(mapError(plans.error))}
        </p>
      ) : null}

      {plans.isSuccess && plans.data.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-6 text-center">
          <p className="font-semibold text-ink-900">{t('plans.empty')}</p>
          <p className="mt-1 text-sm text-ink-600">{t('plans.emptyHint')}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {plans.data?.map((plan) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            busy={setActive.isPending}
          />
        ))}
      </div>

      <PlanFormDialog open={formOpen} onClose={() => setFormOpen(false)} plan={editing} />
    </div>
  );
}
