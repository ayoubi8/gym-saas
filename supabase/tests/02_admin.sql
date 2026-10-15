-- 02_admin.sql — Phase 2 admin gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/02_admin.sql
-- Raises (non-zero exit) on any failure. Mirrors the rls_isolation.sql style.
--
-- Covers the invariants the admin Edge Functions rely on:
--   * only admins may insert/update gyms (RLS)   -> admin_* functions are admin-gated
--   * suspend -> owner policies fail closed (gym_is_active())
--   * reactivate restores access (data kept)
--   * only admins may insert profiles (owner provisioning is admin-only)
--
-- NOTE: Edge Function behaviour itself (JWT re-check, no-mail reset, credentials-once)
-- is covered by the Phase 2 e2e suite; it cannot be exercised from plain SQL.

\echo '=== Phase 2 Admin Tests ==='

-- ============================================================
-- Helper: set JWT claims for a session
-- ============================================================

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
      'user_metadata', json_build_object(
        'role', p_role,
        'gym_id', p_gym_id
      )
    )::text,
    true);
end;
$$;

-- ============================================================
-- Test 1: Owner cannot insert a gym (admin-only RLS)
-- ============================================================

do $$
declare
  v_caught bool := false;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  begin
    insert into public.gyms (name, default_language) values ('Rogue Gym', 'fr');
  exception when others then
    v_caught := true;
  end;

  if not v_caught then
    raise exception 'FAIL Test 1: owner was able to insert a gym';
  end if;
  raise notice 'PASS Test 1: owner cannot insert a gym';
end;
$$;

-- ============================================================
-- Test 2: Owner cannot change another gym's status
-- ============================================================

do $$
declare
  v_rows int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  update public.gyms
  set status = 'suspended'
  where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics v_rows = row_count;

  if v_rows <> 0 then
    raise exception 'FAIL Test 2: owner updated % gym(s) they do not own', v_rows;
  end if;
  raise notice 'PASS Test 2: owner cannot suspend another gym';
end;
$$;

-- ============================================================
-- Test 3: Admin can read all gyms (admin bypass policies)
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', null);

  select count(*) into v_count from public.gyms;

  if v_count < 2 then
    raise exception 'FAIL Test 3: admin sees only % gyms (expected >= 2)', v_count;
  end if;
  raise notice 'PASS Test 3: admin can read all gyms (count=%)', v_count;
end;
$$;

-- ============================================================
-- Test 4: Suspend fails owner policies closed; reactivate restores
-- ============================================================

do $$
declare
  v_rows       int;
  v_is_active  bool;
  v_members    int;
begin
  set local role authenticated;

  -- Admin suspends Gym A
  perform test_set_session('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', null);
  update public.gyms
  set status = 'suspended', suspended_at = now()
  where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'FAIL Test 4a: admin suspend affected % row(s)', v_rows;
  end if;

  -- Owner A now fails closed
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );
  v_is_active := public.gym_is_active();
  if v_is_active then
    raise exception 'FAIL Test 4b: gym_is_active() still true for suspended gym';
  end if;

  select count(*) into v_members
  from public.members
  where gym_id = '11111111-1111-1111-1111-111111111111';
  if v_members <> 0 then
    raise exception 'FAIL Test 4c: suspended owner still sees % member(s)', v_members;
  end if;

  -- Admin reactivates -> data is back
  perform test_set_session('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', null);
  update public.gyms
  set status = 'active', suspended_at = null
  where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'FAIL Test 4d: admin reactivate affected % row(s)', v_rows;
  end if;

  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );
  if not public.gym_is_active() then
    raise exception 'FAIL Test 4e: gym_is_active() false after reactivate';
  end if;

  select count(*) into v_members
  from public.members
  where gym_id = '11111111-1111-1111-1111-111111111111';
  if v_members < 1 then
    raise exception 'FAIL Test 4f: data lost after suspend/reactivate (members=%)', v_members;
  end if;

  raise notice 'PASS Test 4: suspend fails closed, reactivate restores (members=%)', v_members;
end;
$$;

-- ============================================================
-- Test 5: Owner cannot insert profiles (provisioning is admin-only)
-- ============================================================

do $$
declare
  v_caught bool := false;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  begin
    insert into public.profiles (id, gym_id, role, full_name, phone)
    values (
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      '11111111-1111-1111-1111-111111111111',
      'owner', 'Rogue Owner', '+213555000099'
    );
  exception when others then
    v_caught := true;
  end;

  if not v_caught then
    raise exception 'FAIL Test 5: owner was able to insert a profile';
  end if;
  raise notice 'PASS Test 5: owner cannot insert profiles';
end;
$$;

\echo '=== All Phase 2 admin tests PASSED ==='

drop function if exists test_set_session(text, text, text);
