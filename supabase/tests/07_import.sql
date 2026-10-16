-- 07_import.sql — Phase 8 Excel-import gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/07_import.sql
-- Raises (non-zero exit) on any failure. Covers the Phase 8 invariants:
--   * import_validate() classifies rows valid | error | duplicate, reusing
--     the same normalize_dz_phone() as create_member (Arabic-Indic digits)
--   * batch counters + status -> 'previewed'
--   * import_commit() skip vs update; members/subscriptions/payments created;
--     end_date from the file drives the derived status
--   * re-run is a no-op -> BATCH_ALREADY_COMMITTED
--   * cross-gym batches are unreachable -> BAD_FILE
--
-- Fixtures (supabase/seed/seed.sql):
--   gym A 11111111-...  owner A aaaaaaaa-...
--   gym B 22222222-...  owner B bbbbbbbb-...
--   existing member A phone +213555100001

\echo '=== Phase 8 Import Tests ==='

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
-- Test 1: validation classification + counters
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_batch  uuid := '11170001-0000-0000-0000-000000000001';
  v_map    jsonb := jsonb_build_object(
    'full_name', 'Nom', 'phone', 'Téléphone', 'plan', 'Formule',
    'start_date', 'Début', 'end_date', 'Fin',
    'amount_paid', 'Payé', 'amount_remaining', 'Reste'
  );
  v_b      public.import_batches;
  v_status text;
  v_phone  text;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  perform public.create_import_batch(v_batch, v_gym_a, 'members.xlsx', 'imports/' || v_gym_a || '/' || v_batch || '.xlsx');
  perform public.save_import_mapping(v_batch, v_map);

  insert into public.import_rows (batch_id, gym_id, row_no, raw) values
    (v_batch, v_gym_a, 1, jsonb_build_object('Nom', 'أحمد بن علي', 'Téléphone', '٠٥٥٥١٠٠٠١٠')),
    (v_batch, v_gym_a, 2, jsonb_build_object('Nom', '', 'Téléphone', '0555100020')),
    (v_batch, v_gym_a, 3, jsonb_build_object('Nom', 'Karim', 'Téléphone', '123')),
    (v_batch, v_gym_a, 4, jsonb_build_object('Nom', 'Existing', 'Téléphone', '0555 10 00 01')),
    (v_batch, v_gym_a, 5, jsonb_build_object('Nom', 'Same as row 1', 'Téléphone', '+213 555 10 00 10'));

  perform public.import_validate(v_batch);

  -- Arabic name + Arabic-Indic digits normalized on the SAME code path
  select status, normalized ->> 'phone' into v_status, v_phone
  from public.import_rows where batch_id = v_batch and row_no = 1;
  if v_status <> 'valid' or v_phone <> '+213555100010' then
    raise exception 'FAIL 1a: Arabic-Indic row not normalized (%, %)', v_status, v_phone;
  end if;

  select status into v_status from public.import_rows where batch_id = v_batch and row_no = 2;
  if v_status <> 'error' then raise exception 'FAIL 1b: missing name not error (%)', v_status; end if;

  select status into v_status from public.import_rows where batch_id = v_batch and row_no = 3;
  if v_status <> 'error' then raise exception 'FAIL 1c: bad phone not error (%)', v_status; end if;

  select status into v_status from public.import_rows where batch_id = v_batch and row_no = 4;
  if v_status <> 'duplicate' then raise exception 'FAIL 1d: existing phone not duplicate (%)', v_status; end if;

  select status into v_status from public.import_rows where batch_id = v_batch and row_no = 5;
  if v_status <> 'duplicate' then raise exception 'FAIL 1e: in-batch phone not duplicate (%)', v_status; end if;

  select * into v_b from public.import_batches where id = v_batch;
  if v_b.status <> 'previewed'
     or v_b.total_rows <> 5 or v_b.valid_rows <> 1
     or v_b.error_rows <> 2 or v_b.duplicate_rows <> 2 then
    raise exception 'FAIL 1f: counters/status wrong (%)', to_jsonb(v_b);
  end if;

  reset role;
  delete from public.import_batches where id = v_batch;
  raise notice 'PASS Test 1: validation classification + counters';
end;
$$;

-- ============================================================
-- Test 2: commit skip vs update + derived status + idempotency
-- ============================================================

do $$
declare
  v_gym_a    uuid := '11111111-1111-1111-1111-111111111111';
  v_owner_a  uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_batch    uuid := '11170001-0000-0000-0000-000000000002';
  v_map      jsonb := jsonb_build_object(
    'full_name', 'Nom', 'phone', 'Téléphone', 'plan', 'Formule',
    'start_date', 'Début', 'end_date', 'Fin',
    'amount_paid', 'Payé', 'amount_remaining', 'Reste'
  );
  v_plan_id  uuid;
  v_plan_nm  text;
  v_new_mem  uuid := '11110001-0000-0000-0000-0000000000f1';
  v_b        public.import_batches;
  v_sub_end  date;
  v_paid     int;
  v_name     text;
  v_caught   bool := false;
begin
  set local role authenticated;
  perform test_set_session(v_owner_a::text, 'owner', v_gym_a::text);

  select id, name into v_plan_id, v_plan_nm
  from public.plans where gym_id = v_gym_a and type = 'monthly' limit 1;

  perform public.create_import_batch(v_batch, v_gym_a, 'members2.xlsx', null);
  perform public.save_import_mapping(v_batch, v_map);

  insert into public.import_rows (batch_id, gym_id, row_no, raw) values
    (v_batch, v_gym_a, 1, jsonb_build_object(
      'Nom', 'Nouveau Membre', 'Téléphone', '0555100030', 'Formule', v_plan_nm,
      'Début', '2024-01-10', 'Fin', '2024-02-10', 'Payé', '1500', 'Reste', '1500')),
    (v_batch, v_gym_a, 2, jsonb_build_object(
      'Nom', 'Existing Updated', 'Téléphone', '0555 10 00 01', 'Formule', v_plan_nm,
      'Début', '2024-01-10', 'Fin', '2024-02-10', 'Payé', '0', 'Reste', '0'));

  perform public.import_validate(v_batch);
  perform public.import_commit(v_batch, 'skip');

  select * into v_b from public.import_batches where id = v_batch;
  if v_b.status <> 'committed' or v_b.imported_count <> 1 or v_b.skipped_count <> 1 then
    raise exception 'FAIL 2a: skip commit counters wrong (%)', to_jsonb(v_b);
  end if;

  -- New member + subscription (end_date from the file) + payment
  select s.end_date into v_sub_end
  from public.subscriptions s
  where s.member_id = v_new_mem;
  if v_sub_end <> date '2024-02-10' then
    raise exception 'FAIL 2b: imported end_date not applied (%)', v_sub_end;
  end if;

  select coalesce(sum(p.amount_dzd), 0) into v_paid
  from public.payments p
  join public.subscriptions s on s.id = p.subscription_id
  where s.member_id = v_new_mem;
  if v_paid <> 1500 then
    raise exception 'FAIL 2c: imported payment not recorded (%)', v_paid;
  end if;

  -- Existing member is untouched under 'skip'
  select full_name into v_name from public.members where phone = '+213555100001';
  if v_name = 'Existing Updated' then
    raise exception 'FAIL 2d: skip policy modified the existing member';
  end if;

  -- Re-run is a no-op
  begin
    perform public.import_commit(v_batch, 'skip');
  exception when others then
    if sqlstate = 'P0001' then v_caught := true; else raise; end if;
  end;
  if not v_caught then
    raise exception 'FAIL 2e: re-run did not raise BATCH_ALREADY_COMMITTED';
  end if;

  reset role;
  delete from public.payments where member_id = v_new_mem;
  delete from public.subscriptions where member_id = v_new_mem;
  delete from public.members where id = v_new_mem;
  delete from public.import_batches where id = v_batch;
  raise notice 'PASS Test 2: commit skip + derived end_date + idempotency';
end;
$$;

-- ============================================================
-- Test 3: update policy modifies the matched member
-- ============================================================

do $$
declare
  v_gym_a   uuid := '11111111-1111-1111-1111-111111111111';
  v_owner_a uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_batch   uuid := '11170001-0000-0000-0000-000000000003';
  v_map     jsonb := jsonb_build_object('full_name', 'Nom', 'phone', 'Téléphone');
  v_name    text;
  v_orig    text;
begin
  reset role;
  select full_name into v_orig from public.members where phone = '+213555100001';

  set local role authenticated;
  perform test_set_session(v_owner_a::text, 'owner', v_gym_a::text);

  perform public.create_import_batch(v_batch, v_gym_a, 'members3.xlsx', null);
  perform public.save_import_mapping(v_batch, v_map);

  insert into public.import_rows (batch_id, gym_id, row_no, raw) values
    (v_batch, v_gym_a, 1, jsonb_build_object('Nom', 'Updated Name', 'Téléphone', '+213555100001'));

  perform public.import_validate(v_batch);
  perform public.import_commit(v_batch, 'update');

  select full_name into v_name from public.members where phone = '+213555100001';
  if v_name <> 'Updated Name' then
    raise exception 'FAIL 3: update policy did not modify the matched member (%)', v_name;
  end if;

  reset role;
  update public.members set full_name = v_orig where phone = '+213555100001';
  delete from public.import_batches where id = v_batch;
  raise notice 'PASS Test 3: update policy modifies matched member';
end;
$$;

-- ============================================================
-- Test 4: cross-gym batch is unreachable
-- ============================================================

do $$
declare
  v_gym_b   uuid := '22222222-2222-2222-2222-222222222222';
  v_owner_b uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_batch   uuid := '11170001-0000-0000-0000-000000000004';
  v_caught  bool := false;
begin
  set local role authenticated;
  perform test_set_session(v_owner_b::text, 'owner', v_gym_b::text);
  begin
    perform public.import_validate(v_batch);
  exception when others then
    if sqlstate = 'P0001' then v_caught := true; else raise; end if;
  end;
  reset role;
  if not v_caught then
    raise exception 'FAIL 4: cross-gym import_validate was not denied';
  end if;
  raise notice 'PASS Test 4: cross-gym batch unreachable';
end;
$$;

\echo '=== All Phase 8 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
