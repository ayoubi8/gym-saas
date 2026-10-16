-- 06_offline.sql — Phase 7 offline/conflict gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/06_offline.sql
-- Raises (non-zero exit) on any failure. Covers the Phase 7 invariants:
--   * two payments (same subscription+amount+paid_on, different ids) both flagged
--   * a differing payment is NOT flagged
--   * clear_payment_duplicate() un-flags + writes an audit row
--   * clearing is gym-scoped (cross-gym -> RLS_DENIED)
--
-- Fixtures (supabase/seed/seed.sql):
--   gym A 11111111-...  owner A aaaaaaaa-...
--   gym B 22222222-...  owner B bbbbbbbb-...
--   owing sub 11120001-...0005 (gym A)

\echo '=== Phase 7 Offline/Conflict Tests ==='

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
-- Test 1: same subscription+amount+paid_on -> both flagged
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_sub   uuid := '11120001-0000-0000-0000-000000000005';
  v_p1    uuid := '11150001-0000-0000-0000-0000000000c1';
  v_p2    uuid := '11150001-0000-0000-0000-0000000000c2';
  v_p3    uuid := '11150001-0000-0000-0000-0000000000c3';
  v_flag1 bool;
  v_flag2 bool;
  v_flag3 bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  perform public.record_payment(v_p1, v_sub, 4242, current_date, 'cash', null);
  perform public.record_payment(v_p2, v_sub, 4242, current_date, 'cash', null);

  reset role;
  select flagged_duplicate into v_flag1 from public.payments where id = v_p1;
  select flagged_duplicate into v_flag2 from public.payments where id = v_p2;
  if not (v_flag1 and v_flag2) then
    raise exception 'FAIL Test 1a: matching payments not both flagged (%, %)', v_flag1, v_flag2;
  end if;

  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_p3, v_sub, 4243, current_date, 'cash', null);

  reset role;
  select flagged_duplicate into v_flag3 from public.payments where id = v_p3;
  if v_flag3 then
    raise exception 'FAIL Test 1b: a distinct payment was wrongly flagged';
  end if;

  delete from public.payments where id in (v_p1, v_p2, v_p3);
  raise notice 'PASS Test 1: duplicate-payment detection';
end;
$$;

-- ============================================================
-- Test 2: clear_payment_duplicate un-flags + audits
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_sub   uuid := '11120001-0000-0000-0000-000000000005';
  v_p1    uuid := '11150001-0000-0000-0000-0000000000d1';
  v_p2    uuid := '11150001-0000-0000-0000-0000000000d2';
  v_flag  bool;
  v_audit int;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_p1, v_sub, 5151, current_date, 'cash', null);
  perform public.record_payment(v_p2, v_sub, 5151, current_date, 'cash', null);
  perform public.clear_payment_duplicate(v_p1);

  reset role;
  select flagged_duplicate into v_flag from public.payments where id = v_p1;
  if v_flag then
    raise exception 'FAIL Test 2a: clear_payment_duplicate did not un-flag';
  end if;

  select count(*) into v_audit from public.audit_log
  where entity_type = 'payment' and entity_id = v_p1 and action = 'payment.duplicate_reviewed';
  if v_audit < 1 then
    raise exception 'FAIL Test 2b: review not audited';
  end if;

  delete from public.payments where id in (v_p1, v_p2);
  raise notice 'PASS Test 2: clear_payment_duplicate un-flags + audits';
end;
$$;

-- ============================================================
-- Test 3: clear_payment_duplicate is gym-scoped
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_gym_b uuid := '22222222-2222-2222-2222-222222222222';
  v_sub   uuid := '11120001-0000-0000-0000-000000000005';
  v_p1    uuid := '11150001-0000-0000-0000-0000000000e1';
  v_p2    uuid := '11150001-0000-0000-0000-0000000000e2';
  v_caught bool := false;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_p1, v_sub, 6262, current_date, 'cash', null);
  perform public.record_payment(v_p2, v_sub, 6262, current_date, 'cash', null);

  perform test_set_session('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner', v_gym_b::text);
  begin
    perform public.clear_payment_duplicate(v_p1);
  exception when others then
    if sqlstate = '42501' then v_caught := true; else raise; end if;
  end;

  reset role;
  if not v_caught then
    raise exception 'FAIL Test 3: cross-gym clear_payment_duplicate was not denied';
  end if;

  delete from public.payments where id in (v_p1, v_p2);
  raise notice 'PASS Test 3: gym-scoped review';
end;
$$;

\echo '=== All Phase 7 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
