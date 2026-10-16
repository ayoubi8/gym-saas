-- 05_dashboard.sql — Phase 5 dashboard gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/05_dashboard.sql
-- Raises (non-zero exit) on any failure. Mirrors 02_admin / 03 / 04.
--
-- Covers the Phase 5 invariants:
--   * dashboard_summary() is caller-scoped (security_invoker views hold under RLS)
--   * revenue counts payments received in the period, NOT subscription prices
--   * counts reconcile with the underlying lists on the seed fixtures
--   * soft-deleted members are excluded from active/unpaid counts
--
-- Fixtures (supabase/seed/seed.sql):
--   gym A 11111111-...  owner A aaaaaaaa-...
--   member owing 11110001-...0005  sub owing 11120001-...0005 (price 3000, paid 1500)

\echo '=== Phase 5 Dashboard Tests ==='

create or replace function test_set_session(
  p_uid    text,
  p_role   text,
  p_gym_id text default null
) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid, true);
  perform set_config('request.jwt.claims',
    json_build_object(
      'sub', p_uid,
      'role', 'authenticated',
      'user_metadata', json_build_object('role', p_role, 'gym_id', p_gym_id)
    )::text,
    true);
end;
$$;

-- ============================================================
-- Test 1: revenue tracks payments received, not subscription prices
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_sub   uuid := '11120001-0000-0000-0000-000000000005';
  v_pay   uuid := '11150001-0000-0000-0000-0000000000f1';
  v_s0    jsonb;
  v_s1    jsonb;
  v_today date;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  v_s0 := public.dashboard_summary(v_gym_a);
  v_today := (v_s0->>'as_of_date')::date;

  -- Independent reconciliation: revenue_today = SUM(payments.paid_on = today)
  if (v_s0->>'revenue_today')::int <> (
    select coalesce(sum(amount_dzd), 0) from public.payments
    where gym_id = v_gym_a and paid_on = v_today
  ) then
    raise exception 'FAIL Test 1a: revenue_today does not match payments sum';
  end if;

  -- A new payment must move revenue today+month by exactly its amount,
  -- regardless of the subscription price snapshot.
  perform public.record_payment(v_pay, v_sub, 1234, v_today, 'cash', null);
  v_s1 := public.dashboard_summary(v_gym_a);

  if (v_s1->>'revenue_today')::int <> (v_s0->>'revenue_today')::int + 1234 then
    raise exception 'FAIL Test 1b: revenue_today did not move by the payment amount';
  end if;
  if (v_s1->>'revenue_month')::int <> (v_s0->>'revenue_month')::int + 1234 then
    raise exception 'FAIL Test 1c: revenue_month did not move by the payment amount';
  end if;

  reset role;
  delete from public.payments where id = v_pay;

  raise notice 'PASS Test 1: revenue = payments received (not prices)';
end;
$$;

-- ============================================================
-- Test 2: counts reconcile with the underlying lists
-- ============================================================

do $$
declare
  v_gym_a    uuid := '11111111-1111-1111-1111-111111111111';
  v_s        jsonb;
  v_today    date;
  v_active   int;
  v_total    int;
  v_members  int;
  v_expiring int;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  v_s := public.dashboard_summary(v_gym_a);
  v_today := (v_s->>'as_of_date')::date;

  select count(*) into v_active
  from public.member_status where gym_id = v_gym_a and status = 'active';
  if (v_s->>'active_count')::int <> v_active then
    raise exception 'FAIL Test 2a: active_count % <> %', v_s->>'active_count', v_active;
  end if;

  select coalesce(sum(total_owing), 0), count(*) into v_total, v_members
  from public.member_balance
  where gym_id = v_gym_a and total_owing > 0;
  if (v_s->>'unpaid_total')::int <> v_total then
    raise exception 'FAIL Test 2b: unpaid_total % <> %', v_s->>'unpaid_total', v_total;
  end if;
  if (v_s->>'unpaid_member_count')::int <> v_members then
    raise exception 'FAIL Test 2c: unpaid_member_count % <> %', v_s->>'unpaid_member_count', v_members;
  end if;

  select count(*) into v_expiring
  from public.member_current_subscription mcs
  join public.members m on m.id = mcs.member_id
  where mcs.gym_id = v_gym_a
    and mcs.end_date between v_today and v_today + 7
    and mcs.cancelled_at is null
    and m.deleted_at is null;
  if (v_s->>'expiring_week_count')::int <> v_expiring then
    raise exception 'FAIL Test 2d: expiring_week_count % <> %', v_s->>'expiring_week_count', v_expiring;
  end if;

  raise notice 'PASS Test 2: counts reconcile with lists';
end;
$$;

-- ============================================================
-- Test 3: soft-deleted members are excluded from unpaid rollup
-- ============================================================

do $$
declare
  v_gym_a     uuid := '11111111-1111-1111-1111-111111111111';
  v_member    uuid := '11110001-0000-0000-0000-000000000005';
  v_owing     int;
  v_before_m  int;
  v_before_t  int;
  v_after_m   int;
  v_after_t   int;
begin
  select total_owing into v_owing from public.member_balance where member_id = v_member;
  if v_owing is null or v_owing <= 0 then
    raise exception 'FAIL Test 3a: fixture member has no owing (% )', v_owing;
  end if;

  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  v_before_m := (public.dashboard_summary(v_gym_a)->>'unpaid_member_count')::int;
  v_before_t := (public.dashboard_summary(v_gym_a)->>'unpaid_total')::int;

  reset role;
  update public.members set deleted_at = now() where id = v_member;

  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  v_after_m := (public.dashboard_summary(v_gym_a)->>'unpaid_member_count')::int;
  v_after_t := (public.dashboard_summary(v_gym_a)->>'unpaid_total')::int;

  if v_after_m <> v_before_m - 1 then
    raise exception 'FAIL Test 3b: soft-delete did not drop the unpaid member count (% -> %)', v_before_m, v_after_m;
  end if;
  if v_after_t <> v_before_t - v_owing then
    raise exception 'FAIL Test 3c: soft-delete did not drop owing % (% -> %)', v_owing, v_before_t, v_after_t;
  end if;

  reset role;
  update public.members set deleted_at = null where id = v_member;

  raise notice 'PASS Test 3: soft-deleted members excluded from unpaid';
end;
$$;

\echo '=== All Phase 5 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
