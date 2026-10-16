-- ============================================================
-- 0005_phase5_dashboard.sql
-- Phase 5 — Dashboard.
--
-- The 1A `dashboard_summary()` skeleton already computes the six counters;
-- this migration hardens the unpaid rollup so soft-deleted members
-- (AGENTS.md §5.10 — excluded from lists/counts) no longer contribute to
-- `unpaid_total` / `unpaid_member_count`. Signature and jsonb shape are
-- unchanged (no type regen, no new tables/RPCs).
-- ============================================================

create or replace function public.dashboard_summary(p_gym_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_tz text;
  v_today date;
  v_active_count bigint;
  v_revenue_today bigint;
  v_revenue_month bigint;
  v_expiring_week bigint;
  v_unpaid_total bigint;
  v_unpaid_member_count bigint;
begin
  select coalesce(timezone, 'Africa/Algiers')
    into v_tz
    from public.gyms where id = p_gym_id;

  v_today := (now() at time zone v_tz)::date;

  -- active members (member_status already excludes deleted members)
  select count(*) into v_active_count
  from public.member_status ms
  where ms.gym_id = p_gym_id and ms.status = 'active';

  -- revenue today (payments received in the period, never subscription prices)
  select coalesce(sum(amount_dzd), 0) into v_revenue_today
  from public.payments
  where gym_id = p_gym_id and paid_on = v_today;

  -- revenue this calendar month (gym tz)
  select coalesce(sum(amount_dzd), 0) into v_revenue_month
  from public.payments
  where gym_id = p_gym_id
    and date_trunc('month', paid_on) = date_trunc('month', v_today);

  -- expiring this week (next 7 days), live members only
  select count(*) into v_expiring_week
  from public.member_current_subscription mcs
  join public.members m on m.id = mcs.member_id
  where mcs.gym_id = p_gym_id
    and mcs.end_date between v_today and v_today + 7
    and mcs.cancelled_at is null
    and m.deleted_at is null;

  -- unpaid totals (exclude soft-deleted members)
  select
    coalesce(sum(case when sb.remaining > 0 then sb.remaining else 0 end), 0),
    count(distinct case when sb.remaining > 0 then sb.member_id end)
  into v_unpaid_total, v_unpaid_member_count
  from public.subscription_balance sb
  join public.members m on m.id = sb.member_id
  where sb.gym_id = p_gym_id
    and m.deleted_at is null;

  return jsonb_build_object(
    'active_count',        v_active_count,
    'revenue_today',       v_revenue_today,
    'revenue_month',       v_revenue_month,
    'expiring_week_count', v_expiring_week,
    'unpaid_total',        v_unpaid_total,
    'unpaid_member_count', v_unpaid_member_count,
    'as_of_date',          v_today
  );
end;
$$;
