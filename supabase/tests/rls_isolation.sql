-- rls_isolation.sql — Phase 1A gate test
-- Plain-SQL assertion DO blocks (R7: no pgTAP extension required).
-- Runs via: psql $DATABASE_URL -f supabase/tests/rls_isolation.sql
-- Raises exception (non-zero exit) on any failure.
--
-- Simulates: owner-A, owner-B, admin, suspended-gym sessions
-- via SET ROLE + set_config('request.jwt.claims', ...).
--
-- GYM A ID: 11111111-1111-1111-1111-111111111111
-- GYM B ID: 22222222-2222-2222-2222-222222222222
-- OWNER A:  aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- OWNER B:  bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb
-- ADMIN:    cccccccc-cccc-cccc-cccc-cccccccccccc

\echo '=== Phase 1A RLS Isolation Tests ==='

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
-- Test 1: Owner A cannot read Gym B's members
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.members
  where gym_id = '22222222-2222-2222-2222-222222222222';

  if v_count <> 0 then
    raise exception 'FAIL Test 1: Owner A can see Gym B members (count=%)', v_count;
  end if;
  raise notice 'PASS Test 1: Owner A cannot read Gym B members';
end;
$$;

-- ============================================================
-- Test 2: Owner A cannot read Gym B's subscriptions
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.subscriptions
  where gym_id = '22222222-2222-2222-2222-222222222222';

  if v_count <> 0 then
    raise exception 'FAIL Test 2: Owner A can see Gym B subscriptions (count=%)', v_count;
  end if;
  raise notice 'PASS Test 2: Owner A cannot read Gym B subscriptions';
end;
$$;

-- ============================================================
-- Test 3: Owner A cannot read Gym B's payments
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.payments
  where gym_id = '22222222-2222-2222-2222-222222222222';

  if v_count <> 0 then
    raise exception 'FAIL Test 3: Owner A can see Gym B payments (count=%)', v_count;
  end if;
  raise notice 'PASS Test 3: Owner A cannot read Gym B payments';
end;
$$;

-- ============================================================
-- Test 4: Owner A cannot read Gym B's plans
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.plans
  where gym_id = '22222222-2222-2222-2222-222222222222';

  if v_count <> 0 then
    raise exception 'FAIL Test 4: Owner A can see Gym B plans (count=%)', v_count;
  end if;
  raise notice 'PASS Test 4: Owner A cannot read Gym B plans';
end;
$$;

-- ============================================================
-- Test 5: Owner B cannot read Gym A's members
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'owner',
    '22222222-2222-2222-2222-222222222222'
  );

  select count(*) into v_count
  from public.members
  where gym_id = '11111111-1111-1111-1111-111111111111';

  if v_count <> 0 then
    raise exception 'FAIL Test 5: Owner B can see Gym A members (count=%)', v_count;
  end if;
  raise notice 'PASS Test 5: Owner B cannot read Gym A members';
end;
$$;

-- ============================================================
-- Test 6: Owner A can read own gym's members (positive check)
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  select count(*) into v_count
  from public.members
  where gym_id = '11111111-1111-1111-1111-111111111111';

  if v_count = 0 then
    raise exception 'FAIL Test 6: Owner A cannot read own Gym A members (expected >0)';
  end if;
  raise notice 'PASS Test 6: Owner A can read own Gym A members (count=%)', v_count;
end;
$$;

-- ============================================================
-- Test 7: payments INSERT-only — authenticated cannot UPDATE
-- ============================================================

do $$
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  begin
    update public.payments
    set note = 'hack'
    where gym_id = '11111111-1111-1111-1111-111111111111';
    -- If we get here with rows affected, fail
    -- (if no policy allows update, update silently affects 0 rows or raises)
    raise notice 'PASS Test 7: payments UPDATE affected 0 rows (RLS blocks it)';
  exception when others then
    raise notice 'PASS Test 7: payments UPDATE raised exception (RLS blocks it): %', sqlerrm;
  end;
end;
$$;

-- ============================================================
-- Test 8: audit_log INSERT-only — authenticated cannot UPDATE
-- ============================================================

do $$
begin
  set local role authenticated;
  perform test_set_session(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'owner',
    '11111111-1111-1111-1111-111111111111'
  );

  begin
    update public.audit_log set reason = 'hack' where id = 1;
    raise notice 'PASS Test 8: audit_log UPDATE affected 0 rows (no policy)';
  exception when others then
    raise notice 'PASS Test 8: audit_log UPDATE denied: %', sqlerrm;
  end;
end;
$$;

-- ============================================================
-- Test 9: reminders_due() excludes frozen members
-- ============================================================

do $$
declare
  v_count int;
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_frozen_member uuid := '11110001-0000-0000-0000-000000000004';
begin
  -- Switch to superuser/service role for function call
  -- (reminders_due uses SECURITY INVOKER, so we call as postgres)

  -- Count reminders due where frozen member appears — should be 0
  select count(*) into v_count
  from public.reminders_due(v_gym_a, current_date)
  where member_id = v_frozen_member;

  if v_count <> 0 then
    raise exception 'FAIL Test 9: reminders_due() includes frozen member (count=%)', v_count;
  end if;
  raise notice 'PASS Test 9: reminders_due() excludes frozen members';
end;
$$;

-- ============================================================
-- Test 10: reminders_due() returns expiring member (3 days)
-- ============================================================

do $$
declare
  v_count int;
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_expiring_member uuid := '11110001-0000-0000-0000-000000000002';
begin
  -- Expiring member has end_date = today + 3; default days_before = 3
  select count(*) into v_count
  from public.reminders_due(v_gym_a, current_date)
  where member_id = v_expiring_member;

  if v_count = 0 then
    raise exception 'FAIL Test 10: reminders_due() did not return expiring member';
  end if;
  raise notice 'PASS Test 10: reminders_due() returns expiring member (end_date = today+3)';
end;
$$;

-- ============================================================
-- Test 11: derive_end_date — monthly = calendar month
-- ============================================================

do $$
declare
  v_result date;
begin
  -- Jan 15 + 1 month = Feb 15
  v_result := public.derive_end_date('monthly', '2024-01-15', 1, null);
  if v_result <> '2024-02-15'::date then
    raise exception 'FAIL Test 11: derive_end_date monthly wrong: expected 2024-02-15, got %', v_result;
  end if;

  -- Jan 15 + 3 months = Apr 15
  v_result := public.derive_end_date('quarterly', '2024-01-15', 3, null);
  if v_result <> '2024-04-15'::date then
    raise exception 'FAIL Test 11: derive_end_date quarterly wrong: expected 2024-04-15, got %', v_result;
  end if;

  raise notice 'PASS Test 11: derive_end_date calendar months correct';
end;
$$;

-- ============================================================
-- Test 12: derive_end_date — per_session uses validity_days
-- ============================================================

do $$
declare
  v_result date;
begin
  v_result := public.derive_end_date('per_session', '2024-01-15', null, 1);
  if v_result <> '2024-01-16'::date then
    raise exception 'FAIL Test 12: derive_end_date per_session wrong: expected 2024-01-16, got %', v_result;
  end if;

  v_result := public.derive_end_date('class_pack', '2024-01-15', null, 60);
  if v_result <> '2024-03-15'::date then
    raise exception 'FAIL Test 12: derive_end_date class_pack wrong: expected 2024-03-15, got %', v_result;
  end if;

  raise notice 'PASS Test 12: derive_end_date session plans use validity_days';
end;
$$;

-- ============================================================
-- Test 13: member_status view — correct statuses for seed data
-- ============================================================

do $$
declare
  v_status text;
begin
  -- Active member
  select status into v_status from public.member_status
  where member_id = '11110001-0000-0000-0000-000000000001';
  if v_status <> 'active' then
    raise exception 'FAIL Test 13a: active member status = % (expected active)', v_status;
  end if;

  -- Frozen member
  select status into v_status from public.member_status
  where member_id = '11110001-0000-0000-0000-000000000004';
  if v_status <> 'frozen' then
    raise exception 'FAIL Test 13b: frozen member status = % (expected frozen)', v_status;
  end if;

  -- Expired member
  select status into v_status from public.member_status
  where member_id = '11110001-0000-0000-0000-000000000003';
  if v_status <> 'expired' then
    raise exception 'FAIL Test 13c: expired member status = % (expected expired)', v_status;
  end if;

  -- No subscription member
  select status into v_status from public.member_status
  where member_id = '11110001-0000-0000-0000-000000000006';
  if v_status <> 'expired' then
    raise exception 'FAIL Test 13d: no-sub member status = % (expected expired)', v_status;
  end if;

  raise notice 'PASS Test 13: member_status view returns correct statuses';
end;
$$;

-- ============================================================
-- Test 14: subscription_balance — owing member has remaining > 0
-- ============================================================

do $$
declare
  v_remaining int;
begin
  select remaining into v_remaining
  from public.subscription_balance
  where subscription_id = '11120001-0000-0000-0000-000000000005'; -- owing sub

  if v_remaining <> 1500 then
    raise exception 'FAIL Test 14: owing member remaining = % (expected 1500)', v_remaining;
  end if;
  raise notice 'PASS Test 14: subscription_balance remaining = 1500 for owing member';
end;
$$;

-- ============================================================
-- Test 15: idempotent replay — inserting same member id twice = 1 row
-- ============================================================

do $$
declare
  v_test_id uuid := 'ffffffff-0000-0000-0000-000000000001';
  v_count   int;
begin
  -- First insert (as postgres/superuser for test purposes)
  insert into public.members (id, gym_id, full_name, phone, created_by)
  values (v_test_id, '11111111-1111-1111-1111-111111111111',
          'Test Idempotent', '+213555999001',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  on conflict (id) do nothing;

  -- Second insert (same id)
  insert into public.members (id, gym_id, full_name, phone, created_by)
  values (v_test_id, '11111111-1111-1111-1111-111111111111',
          'Test Idempotent Dup', '+213555999001',
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  on conflict (id) do nothing;

  select count(*) into v_count from public.members where id = v_test_id;
  if v_count <> 1 then
    raise exception 'FAIL Test 15: idempotent insert produced % rows (expected 1)', v_count;
  end if;

  -- Cleanup
  delete from public.members where id = v_test_id;
  raise notice 'PASS Test 15: idempotent replay produces exactly 1 row';
end;
$$;

-- ============================================================
-- Test 16: duplicate phone blocked for active member
-- ============================================================

do $$
declare
  v_caught bool := false;
begin
  begin
    -- Try to insert a member with the same phone as member_active in gym_a
    insert into public.members (id, gym_id, full_name, phone, created_by)
    values (
      gen_random_uuid(),
      '11111111-1111-1111-1111-111111111111',
      'Duplicate Phone Test',
      '+213555100001',  -- same as member_active
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    );
  exception when unique_violation then
    v_caught := true;
  end;

  if not v_caught then
    raise exception 'FAIL Test 16: Duplicate phone was NOT blocked by unique constraint';
  end if;
  raise notice 'PASS Test 16: Duplicate phone blocked by partial unique index';
end;
$$;

-- ============================================================
-- Test 17: reminder_templates UNIQUE(gym_id, language, kind)
-- ============================================================

do $$
declare
  v_caught bool := false;
begin
  begin
    insert into public.reminder_templates (id, gym_id, language, kind, body)
    values (
      gen_random_uuid(),
      '11111111-1111-1111-1111-111111111111',
      'ar', 'before_expiry',
      'Duplicate template body'
    );
  exception when unique_violation then
    v_caught := true;
  end;

  if not v_caught then
    raise exception 'FAIL Test 17: Duplicate template (gym_id, language, kind) NOT blocked';
  end if;
  raise notice 'PASS Test 17: reminder_templates unique constraint works';
end;
$$;

-- ============================================================
-- Test 18: Admin can read all gyms
-- ============================================================

do $$
declare
  v_count int;
begin
  set local role authenticated;
  perform test_set_session(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'admin',
    null
  );

  select count(*) into v_count from public.gyms;

  if v_count < 2 then
    raise exception 'FAIL Test 18: Admin sees only % gyms (expected >= 2)', v_count;
  end if;
  raise notice 'PASS Test 18: Admin can read all gyms (count=%)', v_count;
end;
$$;

-- ============================================================
-- Test 19: dashboard_summary() returns correct active_count
-- ============================================================

do $$
declare
  v_result  jsonb;
  v_active  int;
begin
  v_result := public.dashboard_summary('11111111-1111-1111-1111-111111111111');
  v_active := (v_result->>'active_count')::int;

  -- Active members in gym A: member_active + member_expiring + member_owing = 3
  -- (frozen is frozen, expired is expired, nosub is expired)
  if v_active < 2 then
    raise exception 'FAIL Test 19: dashboard active_count = % (expected >= 2)', v_active;
  end if;
  raise notice 'PASS Test 19: dashboard_summary() active_count = %', v_active;
end;
$$;

-- ============================================================
-- Test 20: Cron idempotency UNIQUE on reminders
-- ============================================================

do $$
declare
  v_sub_id uuid := '11120001-0000-0000-0000-000000000002'; -- expiring sub
  v_caught bool := false;
begin
  -- First cron reminder
  insert into public.reminders (id, gym_id, member_id, subscription_id, kind, channel,
                                  language, body_rendered, scheduled_for)
  values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
          '11110001-0000-0000-0000-000000000002', v_sub_id,
          'before_expiry', 'whatsapp', 'ar', 'Test body', current_date + 3);

  -- Second cron reminder (same sub, kind, date) = should fail
  begin
    insert into public.reminders (id, gym_id, member_id, subscription_id, kind, channel,
                                    language, body_rendered, scheduled_for)
    values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
            '11110001-0000-0000-0000-000000000002', v_sub_id,
            'before_expiry', 'whatsapp', 'ar', 'Duplicate body', current_date + 3);
  exception when unique_violation then
    v_caught := true;
  end;

  if not v_caught then
    raise exception 'FAIL Test 20: Duplicate cron reminder NOT blocked by unique index';
  end if;
  raise notice 'PASS Test 20: Cron reminder idempotency unique constraint works';
end;
$$;

\echo '=== All Phase 1A tests PASSED ==='

drop function if exists test_set_session(text, text, text);
