-- 03_members_plans.sql — Phase 3 members / plans / subscriptions gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/03_members_plans.sql
-- Raises (non-zero exit) on any failure. Mirrors the 02_admin.sql style.
--
-- Covers the Phase 3 invariants:
--   * views (member_status, *_balance, member_current_subscription) are now
--     security_invoker -> a spoofed session cannot read another gym through them
--   * is_admin()/current_gym_id() read public.profiles, not user_metadata
--   * normalize_dz_phone() port (parity with TS)
--   * server-side phone normalization + INVALID_PHONE / DUPLICATE_PHONE
--   * update_member is gym-scoped -> MEMBER_NOT_FOUND cross-gym
--   * renew start rule (day after current end, or today when expired)
--   * ALREADY_RENEWED / PAUSE_ALREADY_OPEN / RESUME_BEFORE_START / INVALID_DAYS
--   * resume extends end_date by the paused days
--   * session plans: deduct_session floors at 0 with NO_SESSIONS_REMAINING
--
-- Fixtures (supabase/seed/seed.sql):
--   gym A 11111111-...  gym B 22222222-...   owner A aaaaaaaa-...  admin cccccccc-...
--   plan monthly A 10000001-...0001  plan class_pack A 10000001-...0003
--   member active 11110001-...0001  member expired 11110001-...0003
--   member B 22220001-...0001  sub active 11120001-...0001  sub frozen 11120001-...0004

\echo '=== Phase 3 Members / Plans / Subscriptions Tests ==='

-- ============================================================
-- Helper: set JWT claims for a session
-- (identity is now resolved from public.profiles via auth.uid(); the
--  role/gym args are kept only to simulate a spoofed user_metadata.)
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
-- Test 1: security_invoker views do not leak across gyms
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_gym_b uuid := '22222222-2222-2222-2222-222222222222';
  v_a     int;
  v_b     int;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  select count(*) into v_b from public.member_status where gym_id = v_gym_b;
  select count(*) into v_a from public.member_status;
  if v_b <> 0 then
    raise exception 'FAIL Test 1a: owner A sees % gym B row(s) via member_status', v_b;
  end if;
  if v_a < 6 then
    raise exception 'FAIL Test 1b: owner A sees only % member_status row(s)', v_a;
  end if;

  select count(*) into v_b from public.member_current_subscription where gym_id = v_gym_b;
  if v_b <> 0 then
    raise exception 'FAIL Test 1c: owner A sees % gym B row(s) via member_current_subscription', v_b;
  end if;

  select count(*) into v_b from public.subscription_balance where gym_id = v_gym_b;
  if v_b <> 0 then
    raise exception 'FAIL Test 1d: owner A sees % gym B row(s) via subscription_balance', v_b;
  end if;

  select count(*) into v_b from public.member_balance where gym_id = v_gym_b;
  if v_b <> 0 then
    raise exception 'FAIL Test 1e: owner A sees % gym B row(s) via member_balance', v_b;
  end if;

  raise notice 'PASS Test 1: views are security_invoker (no cross-gym leak)';
end;
$$;

-- ============================================================
-- Test 2: RLS helpers read profiles, spoofed user_metadata is ignored
-- ============================================================

do $$
declare
  v_gym_a uuid := '11111111-1111-1111-1111-111111111111';
  v_gym_b uuid := '22222222-2222-2222-2222-222222222222';
  v_leak  int;
begin
  set local role authenticated;

  -- owner A pretends to be an admin of gym B in user_metadata
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', v_gym_b::text);
  if public.is_admin() then
    raise exception 'FAIL Test 2a: spoofed user_metadata granted is_admin()';
  end if;
  if public.current_gym_id() <> v_gym_a then
    raise exception 'FAIL Test 2b: current_gym_id() trusts user_metadata (got %)', public.current_gym_id();
  end if;

  select count(*) into v_leak from public.member_status where gym_id = v_gym_b;
  if v_leak <> 0 then
    raise exception 'FAIL Test 2c: spoofed session leaked % gym B row(s)', v_leak;
  end if;

  perform test_set_session('cccccccc-cccc-cccc-cccc-cccccccccccc', 'admin', null);
  if not public.is_admin() then
    raise exception 'FAIL Test 2d: admin profile not recognised as admin';
  end if;

  raise notice 'PASS Test 2: helpers use profiles, spoofing ignored';
end;
$$;

-- ============================================================
-- Test 3: normalize_dz_phone() parity (TS <-> SQL)
-- ============================================================

do $$
declare
  v_out  text;
  cases  text[][] := array[
    array['0555 12 34 56',       '+213555123456'],
    array['+213 555 12 34 56',   '+213555123456'],
    array['00213 555 12 34 56',  '+213555123456'],
    array['٠٥٥٥ ١٢ ٣٤ ٥٦',        '+213555123456'],
    array['555123456',           '+213555123456']
  ];
  c text[];
begin
  foreach c slice 1 in array cases loop
    v_out := public.normalize_dz_phone(c[1]);
    if v_out is distinct from c[2] then
      raise exception 'FAIL Test 3: normalize(% ) = % (expected %)', c[1], v_out, c[2];
    end if;
  end loop;

  if public.normalize_dz_phone('0012345') is not null then
    raise exception 'FAIL Test 3: invalid number was normalised';
  end if;
  if public.normalize_dz_phone('') is not null then
    raise exception 'FAIL Test 3: empty string was normalised';
  end if;

  raise notice 'PASS Test 3: normalize_dz_phone parity';
end;
$$;

-- ============================================================
-- Test 4: create_member normalises; duplicate/invalid handled; update is gym-scoped
-- ============================================================

do $$
declare
  v_gym_a   uuid := '11111111-1111-1111-1111-111111111111';
  v_member  public.members;
  v_caught  bool;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  v_member := public.create_member(
    '11110001-0000-0000-0000-0000000000f1', v_gym_a, 'Test Member', '0555 99 88 77', 'ar');
  if v_member.phone <> '+213555998877' then
    raise exception 'FAIL Test 4a: phone stored as % (expected +213555998877)', v_member.phone;
  end if;

  v_caught := false;
  begin
    perform public.create_member(
      '11110001-0000-0000-0000-0000000000f2', v_gym_a, 'Dup', '0555998877', 'ar');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%DUPLICATE_PHONE%' then
      raise exception 'FAIL Test 4b: expected DUPLICATE_PHONE, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 4b: duplicate phone not rejected'; end if;

  v_caught := false;
  begin
    perform public.create_member(
      '11110001-0000-0000-0000-0000000000f3', v_gym_a, 'Bad', 'not-a-phone', 'ar');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%INVALID_PHONE%' then
      raise exception 'FAIL Test 4c: expected INVALID_PHONE, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 4c: invalid phone not rejected'; end if;

  -- Cross-gym update must fail closed
  v_caught := false;
  begin
    perform public.update_member('22220001-0000-0000-0000-000000000001', 'Hacked', '0555 20 00 01', 'fr');
  exception when others then
    v_caught := true;
    if sqlerrm not like '%MEMBER_NOT_FOUND%' then
      raise exception 'FAIL Test 4d: expected MEMBER_NOT_FOUND, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 4d: cross-gym update succeeded'; end if;

  reset role;
  delete from public.members where id = '11110001-0000-0000-0000-0000000000f1';

  raise notice 'PASS Test 4: create/update member guards';
end;
$$;

-- ============================================================
-- Test 5: renew start rule (expired -> starts today)
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_plan   uuid := '10000001-0000-0000-0000-000000000001';
  v_member uuid := '11110001-0000-0000-0000-000000000003'; -- expired
  v_sub    public.subscriptions;
  v_today  date := (now() at time zone 'Africa/Algiers')::date;
  v_new    uuid := '11120001-0000-0000-0000-0000000000f1';
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  v_sub := public.renew_subscription(v_new, v_gym_a, v_member, v_plan, null);

  if v_sub.start_date <> v_today then
    raise exception 'FAIL Test 5: renew of expired sub started % (expected today %)', v_sub.start_date, v_today;
  end if;
  if v_sub.end_date <> (v_today + interval '1 month')::date then
    raise exception 'FAIL Test 5: end_date % (expected %)', v_sub.end_date, (v_today + interval '1 month')::date;
  end if;

  reset role;
  delete from public.subscriptions where id = v_new;

  raise notice 'PASS Test 5: renew start rule';
end;
$$;

-- ============================================================
-- Test 6: ALREADY_RENEWED when a successor already exists
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_plan   uuid := '10000001-0000-0000-0000-000000000001';
  v_member uuid := '11110001-0000-0000-0000-000000000001'; -- active
  v_cur    uuid := '11120001-0000-0000-0000-000000000001'; -- current sub
  v_succ   uuid := '11120001-0000-0000-0000-0000000000f2';
  v_caught bool;
begin
  -- Successor with an end_date before the current sub's end_date keeps the
  -- current sub "current" (member_current_subscription orders by end desc).
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, renewed_from_id, created_by)
  values (
    v_succ, v_gym_a, v_member, v_plan, 'x', 'monthly',
    0, current_date, current_date, v_cur, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  v_caught := false;
  begin
    perform public.renew_subscription(
      '11120001-0000-0000-0000-0000000000f3', v_gym_a, v_member, v_plan, null);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%ALREADY_RENEWED%' then
      raise exception 'FAIL Test 6: expected ALREADY_RENEWED, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 6: already-renewed not rejected'; end if;

  reset role;
  delete from public.subscriptions where id = v_succ;

  raise notice 'PASS Test 6: ALREADY_RENEWED guard';
end;
$$;

-- ============================================================
-- Test 7: assign / pause / resume extends / extend guards
-- ============================================================

do $$
declare
  v_gym_a   uuid := '11111111-1111-1111-1111-111111111111';
  v_plan    uuid := '10000001-0000-0000-0000-000000000001';
  v_member  uuid := '11110001-0000-0000-0000-0000000000f4';
  v_sub_id  uuid := '11120001-0000-0000-0000-0000000000f4';
  v_pause1  uuid := '11130001-0000-0000-0000-0000000000f4';
  v_pause2  uuid := '11130001-0000-0000-0000-0000000000f5';
  v_sub     public.subscriptions;
  v_end0    date;
  v_resumed public.subscriptions;
  v_pause   public.pauses;
  v_caught  bool;
  v_today   date := (now() at time zone 'Africa/Algiers')::date;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  perform public.create_member(v_member, v_gym_a, 'Lifecycle', '+213555900004', 'ar');

  v_sub  := public.assign_subscription(v_sub_id, v_gym_a, v_member, v_plan, v_today, null);
  v_end0 := v_sub.end_date;
  if v_sub.plan_name_snapshot <> 'شهري' or v_sub.price_dzd <> 3000 then
    raise exception 'FAIL Test 7a: plan snapshot not copied (name=%, price=%)',
      v_sub.plan_name_snapshot, v_sub.price_dzd;
  end if;

  v_pause := public.pause_subscription(v_pause1, v_sub_id, v_gym_a, v_today, 'travel', null, null);
  if v_pause.resumed_on is not null then
    raise exception 'FAIL Test 7b: new pause already resumed';
  end if;

  v_caught := false;
  begin
    perform public.pause_subscription(
      '11130001-0000-0000-0000-0000000000f6', v_sub_id, v_gym_a, v_today, 'travel', null, null);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%PAUSE_ALREADY_OPEN%' then
      raise exception 'FAIL Test 7c: expected PAUSE_ALREADY_OPEN, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 7c: second open pause allowed'; end if;

  v_resumed := public.resume_subscription(v_pause1, v_today + 5);
  if v_resumed.end_date <> (v_end0 + 5) then
    raise exception 'FAIL Test 7d: resume did not extend by 5 days (% -> %)', v_end0, v_resumed.end_date;
  end if;
  if (select days_added from public.pauses where id = v_pause1) <> 5 then
    raise exception 'FAIL Test 7e: days_added not recorded';
  end if;

  v_caught := false;
  begin
    perform public.extend_subscription(
      '11140001-0000-0000-0000-0000000000f7', v_gym_a, v_sub_id, 0, 'compensation', null);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%INVALID_DAYS%' then
      raise exception 'FAIL Test 7f: expected INVALID_DAYS, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 7f: zero-day extension allowed'; end if;

  -- resume before the pause start
  perform public.pause_subscription(v_pause2, v_sub_id, v_gym_a, v_today + 10, 'travel', null, null);
  v_caught := false;
  begin
    perform public.resume_subscription(v_pause2, v_today + 5);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%RESUME_BEFORE_START%' then
      raise exception 'FAIL Test 7g: expected RESUME_BEFORE_START, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 7g: resume before start allowed'; end if;

  reset role;
  delete from public.pauses where subscription_id = v_sub_id;
  delete from public.subscriptions where id = v_sub_id;
  delete from public.members where id = v_member;

  raise notice 'PASS Test 7: assign/pause/resume/extend guards';
end;
$$;

-- ============================================================
-- Test 8: session plans — deduct_session floors at 0
-- ============================================================

do $$
declare
  v_gym_a  uuid := '11111111-1111-1111-1111-111111111111';
  v_plan   uuid := '10000001-0000-0000-0000-000000000003'; -- class_pack, 10 sessions
  v_member uuid := '11110001-0000-0000-0000-0000000000f5';
  v_sub_id uuid := '11120001-0000-0000-0000-0000000000f5';
  v_sub    public.subscriptions;
  v_caught bool;
  v_today  date := (now() at time zone 'Africa/Algiers')::date;
  i        int;
begin
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym_a::text);

  perform public.create_member(v_member, v_gym_a, 'Pack', '+213555900005', 'ar');
  v_sub := public.assign_subscription(v_sub_id, v_gym_a, v_member, v_plan, v_today, null);
  if v_sub.sessions_remaining <> 10 then
    raise exception 'FAIL Test 8a: sessions_remaining = % (expected 10)', v_sub.sessions_remaining;
  end if;

  for i in 1..10 loop
    v_sub := public.deduct_session(gen_random_uuid(), v_gym_a, v_sub_id, null);
  end loop;
  if v_sub.sessions_remaining <> 0 then
    raise exception 'FAIL Test 8b: sessions_remaining = % (expected 0)', v_sub.sessions_remaining;
  end if;

  v_caught := false;
  begin
    perform public.deduct_session(gen_random_uuid(), v_gym_a, v_sub_id, null);
  exception when others then
    v_caught := true;
    if sqlerrm not like '%NO_SESSIONS_REMAINING%' then
      raise exception 'FAIL Test 8c: expected NO_SESSIONS_REMAINING, got %', sqlerrm;
    end if;
  end;
  if not v_caught then raise exception 'FAIL Test 8c: over-deduct allowed'; end if;

  reset role;
  delete from public.session_logs where subscription_id = v_sub_id;
  delete from public.subscriptions where id = v_sub_id;
  delete from public.members where id = v_member;

  raise notice 'PASS Test 8: session deduction guard';
end;
$$;

\echo '=== All Phase 3 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
