-- 04_payments.sql — Phase 4 payments / receipts gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/04_payments.sql
-- Raises (non-zero exit) on any failure. Mirrors 02_admin.sql / 03_members_plans.sql.
--
-- Covers the Phase 4 invariants:
--   * direct UPDATE/DELETE of payments by `authenticated` is refused (RLS, no policy)
--   * record_payment: idempotent replay (same client uuid = 1 row, no counter bump),
--     INVALID_AMOUNT for <= 0, receipt_no strictly increasing per gym
--   * edit_payment / delete_payment: REASON_REQUIRED, audit_log old/new written
--   * edit/delete are gym-scoped -> RLS_DENIED cross-gym
--
-- Fixtures (supabase/seed/seed.sql):
--   gym A 11111111-...  gym B 22222222-...
--   owner A aaaaaaaa-...  owner B bbbbbbbb-...
--   sub owing A 11120001-...0005 (member owing 11110001-...0005)
--   gym A receipt counter starts at 2, gym B at 1.

\echo '=== Phase 4 Payments / Receipts Tests ==='

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
-- Test 1: record_payment — receipt_no, replay idempotency, INVALID_AMOUNT
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_sub    uuid := '11120001-0000-0000-0000-000000000005';
  v_f1     uuid := '11140001-0000-0000-0000-0000000000f1';
  v_f2     uuid := '11140001-0000-0000-0000-0000000000f2';
  v_f4     uuid := '11140001-0000-0000-0000-0000000000f4';
  v_r1     public.payments;
  v_r2     public.payments;
  v_replay public.payments;
  v_r4     public.payments;
  v_count  int;
  v_caught bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  v_r1 := public.record_payment(v_f1, v_sub, 500, current_date, 'cash', null);
  if v_r1.receipt_no is null or v_r1.receipt_no <= 0 then
    raise exception 'FAIL Test 1a: receipt_no not stamped (%)', v_r1.receipt_no;
  end if;
  if v_r1.gym_id <> v_gym_a or v_r1.member_id <> '11110001-0000-0000-0000-000000000005' then
    raise exception 'FAIL Test 1b: record_payment did not resolve gym/member';
  end if;

  v_r2 := public.record_payment(v_f2, v_sub, 700, current_date, 'ccp', 'ref 42');
  if v_r2.receipt_no <> v_r1.receipt_no + 1 then
    raise exception 'FAIL Test 1c: receipt_no not increasing (% -> %)', v_r1.receipt_no, v_r2.receipt_no;
  end if;

  -- Replay of the first uuid must return the stored row and NOT bump the counter.
  v_replay := public.record_payment(v_f1, v_sub, 500, current_date, 'cash', null);
  if v_replay.id <> v_f1 or v_replay.receipt_no <> v_r1.receipt_no then
    raise exception 'FAIL Test 1d: replay returned a different row (receipt_no %)', v_replay.receipt_no;
  end if;
  select count(*) into v_count from public.payments where id = v_f1;
  if v_count <> 1 then raise exception 'FAIL Test 1e: replay created % rows', v_count; end if;

  v_r4 := public.record_payment(v_f4, v_sub, 100, current_date, 'cash', null);
  if v_r4.receipt_no <> v_r2.receipt_no + 1 then
    raise exception 'FAIL Test 1f: replay bumped the receipt counter (% expected %)',
      v_r4.receipt_no, v_r2.receipt_no + 1;
  end if;

  v_caught := false;
  begin
    perform public.record_payment(gen_random_uuid(), v_sub, 0, current_date, 'cash', null);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%INVALID_AMOUNT%' then
      raise exception 'FAIL Test 1g: expected INVALID_AMOUNT, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 1g: zero amount accepted'; end if;

  reset role;
  delete from public.payments where id in (v_f1, v_f2, v_f4);

  raise notice 'PASS Test 1: record_payment (receipt_no, replay, INVALID_AMOUNT)';
end;
$$;

-- ============================================================
-- Test 2: direct UPDATE / DELETE by authenticated is refused
-- ============================================================

do $$
declare
  v_gym_a   uuid := '11111111-1111-1111-1111-111111111111';
  v_sub     uuid := '11120001-0000-0000-0000-000000000005';
  v_pay     uuid := '11140001-0000-0000-0000-0000000000d1';
  v_rows    int;
  v_amount  int;
  v_exists  int;
  v_tampered bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_pay, v_sub, 900, current_date, 'cash', null);

  v_tampered := false;
  begin
    update public.payments set amount_dzd = 1 where id = v_pay;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then v_tampered := true; end if;
  exception when insufficient_privilege then
    v_tampered := false;
  end;
  if v_tampered then raise exception 'FAIL Test 2a: direct UPDATE changed a payment'; end if;

  select amount_dzd into v_amount from public.payments where id = v_pay;
  if v_amount <> 900 then raise exception 'FAIL Test 2b: amount tampered to %', v_amount; end if;

  v_tampered := false;
  begin
    delete from public.payments where id = v_pay;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then v_tampered := true; end if;
  exception when insufficient_privilege then
    v_tampered := false;
  end;
  if v_tampered then raise exception 'FAIL Test 2c: direct DELETE removed a payment'; end if;

  select count(*) into v_exists from public.payments where id = v_pay;
  if v_exists <> 1 then raise exception 'FAIL Test 2d: payment missing after refused delete'; end if;

  reset role;
  delete from public.payments where id = v_pay;

  raise notice 'PASS Test 2: direct UPDATE/DELETE refused (RLS)';
end;
$$;

-- ============================================================
-- Test 3: edit_payment — REASON_REQUIRED + audit old/new
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_sub    uuid := '11120001-0000-0000-0000-000000000005';
  v_pay    uuid := '11140001-0000-0000-0000-0000000000e1';
  v_old    public.payments;
  v_new    public.payments;
  v_audit  public.audit_log;
  v_caught bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  v_old := public.record_payment(v_pay, v_sub, 500, current_date, 'cash', null);

  v_caught := false;
  begin
    perform public.edit_payment(v_pay, 800, current_date, 'cash', null, '   ');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%REASON_REQUIRED%' then
      raise exception 'FAIL Test 3a: expected REASON_REQUIRED, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 3a: edit without reason allowed'; end if;

  v_new := public.edit_payment(v_pay, 800, current_date - 1, 'bank_transfer', 'corrected', 'typo');
  if v_new.amount_dzd <> 800 or v_new.paid_on <> current_date - 1 or v_new.method <> 'bank_transfer' then
    raise exception 'FAIL Test 3b: edit did not apply';
  end if;
  if v_new.edited_at is null then raise exception 'FAIL Test 3c: edited_at not stamped'; end if;

  select * into v_audit from public.audit_log
    where entity_id = v_pay and action = 'edit_payment'
    order by id desc limit 1;
  if not found then raise exception 'FAIL Test 3d: no edit_payment audit row'; end if;
  if (v_audit.old_value->>'amount_dzd')::int <> 500 or (v_audit.new_value->>'amount_dzd')::int <> 800 then
    raise exception 'FAIL Test 3e: audit old/new wrong (%, %)',
      v_audit.old_value->>'amount_dzd', v_audit.new_value->>'amount_dzd';
  end if;
  if v_audit.reason <> 'typo' then raise exception 'FAIL Test 3f: audit reason not stored'; end if;

  reset role;
  delete from public.audit_log where entity_id = v_pay;
  delete from public.payments where id = v_pay;

  raise notice 'PASS Test 3: edit_payment reason + audit';
end;
$$;

-- ============================================================
-- Test 4: delete_payment — REASON_REQUIRED + audit
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_sub    uuid := '11120001-0000-0000-0000-000000000005';
  v_pay    uuid := '11140001-0000-0000-0000-0000000000e2';
  v_audit  public.audit_log;
  v_count  int;
  v_caught bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_pay, v_sub, 600, current_date, 'cash', null);

  v_caught := false;
  begin
    perform public.delete_payment(v_pay, '');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%REASON_REQUIRED%' then
      raise exception 'FAIL Test 4a: expected REASON_REQUIRED, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 4a: delete without reason allowed'; end if;

  perform public.delete_payment(v_pay, 'duplicate entry');

  select count(*) into v_count from public.payments where id = v_pay;
  if v_count <> 0 then raise exception 'FAIL Test 4b: payment not deleted'; end if;

  select * into v_audit from public.audit_log
    where entity_id = v_pay and action = 'delete_payment'
    order by id desc limit 1;
  if not found then raise exception 'FAIL Test 4c: no delete_payment audit row'; end if;
  if v_audit.old_value is null or v_audit.new_value is not null then
    raise exception 'FAIL Test 4d: delete audit old/new wrong';
  end if;
  if (v_audit.old_value->>'amount_dzd')::int <> 600 then
    raise exception 'FAIL Test 4e: delete audit amount wrong';
  end if;

  reset role;
  delete from public.audit_log where entity_id = v_pay;

  raise notice 'PASS Test 4: delete_payment reason + audit';
end;
$$;

-- ============================================================
-- Test 5: edit/delete are gym-scoped (RLS_DENIED cross-gym)
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_sub    uuid := '11120001-0000-0000-0000-000000000005';
  v_pay    uuid := '11140001-0000-0000-0000-0000000000e3';
  v_caught bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);
  perform public.record_payment(v_pay, v_sub, 400, current_date, 'cash', null);

  -- owner B must not touch gym A's payment, even via the definer RPCs.
  perform test_set_session('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner',
    '22222222-2222-2222-2222-222222222222');

  v_caught := false;
  begin
    perform public.edit_payment(v_pay, 1, current_date, 'cash', null, 'hack');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%RLS_DENIED%' then
      raise exception 'FAIL Test 5a: expected RLS_DENIED, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 5a: cross-gym edit allowed'; end if;

  v_caught := false;
  begin
    perform public.delete_payment(v_pay, 'hack');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%RLS_DENIED%' then
      raise exception 'FAIL Test 5b: expected RLS_DENIED, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 5b: cross-gym delete allowed'; end if;

  reset role;
  delete from public.payments where id = v_pay;

  raise notice 'PASS Test 5: cross-gym edit/delete denied';
end;
$$;

\echo '=== All Phase 4 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
