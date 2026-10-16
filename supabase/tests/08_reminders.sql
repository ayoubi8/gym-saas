-- 08_reminders.sql — Phase 9 reminders gate test
-- Plain-SQL assertion DO blocks (no pgTAP). Runs via:
--   psql $DATABASE_URL -f supabase/tests/08_reminders.sql
-- Raises (non-zero exit) on any failure. Mirrors 02_admin / 03 / 04 / 05 / 07.
--
-- Covers the Phase 9 invariants (docs/plans/09-reminders.md):
--   * reminders_due() window + exclusions (frozen, already-renewed, deleted)
--   * expiry-day toggle; global off = empty set; gym-timezone default date
--   * insert_cron_reminders() is idempotent (double cron = no duplicate rows)
--   * log_manual_reminder(): REMINDERS_DISABLED + ALREADY_SENT + manual status
--   * render_reminder() + validate_reminder_body() variable contract
--
-- Self-contained: builds its own random gym so it never depends on seed dates.

\echo '=== Phase 9 Reminders Tests ==='

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

-- Insert a member + one subscription (optionally frozen / renewed / deleted).
create or replace function test_mk_sub(
  p_gym     uuid,
  p_name    text,
  p_end     date,
  p_frozen  boolean default false,
  p_renewed boolean default false,
  p_deleted boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_m  uuid := gen_random_uuid();
  v_s  uuid := gen_random_uuid();
  v_s2 uuid := gen_random_uuid();
begin
  insert into public.members (id, gym_id, full_name, phone)
  values (v_m, p_gym, p_name, '+213' || lpad((floor(random() * 1000000000))::bigint::text, 9, '0'));

  insert into public.subscriptions (
    id, gym_id, member_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_at
  )
  values (
    v_s, p_gym, v_m, 'Mensuel', 'monthly',
    3000, p_end - interval '1 month', p_end, now() - interval '10 days'
  );

  if p_frozen then
    insert into public.pauses (gym_id, subscription_id, start_date, reason)
    values (p_gym, v_s, p_end - 5, 'travel');
  end if;

  if p_renewed then
    insert into public.subscriptions (
      id, gym_id, member_id, plan_name_snapshot, plan_type_snapshot,
      price_dzd, start_date, end_date, created_at
    )
    values (
      v_s2, p_gym, v_m, 'Mensuel', 'monthly',
      3000, p_end, p_end + interval '1 month', now()
    );
  end if;

  if p_deleted then
    update public.members set deleted_at = now() where id = v_m;
  end if;

  return v_m;
end;
$$;

-- ============================================================
-- Test 1: window boundary + exclusions
-- ============================================================

do $$
declare
  v_gym     uuid := gen_random_uuid();
  v_m_hit   uuid;
  v_rows    int;
  v_kind    public.reminder_kind;
  v_today   date;
begin
  reset role;
  v_today := (now() at time zone 'Africa/Algiers')::date;

  insert into public.gyms (id, name, default_language, status, timezone)
  values (v_gym, 'Phase9 Test Gym', 'fr', 'active', 'Africa/Algiers');
  insert into public.gym_settings (gym_id, reminders_enabled, reminder_days_before, reminder_on_expiry_day, enabled_channels)
  values (v_gym, true, 3, false, '{whatsapp}');

  v_m_hit := test_mk_sub(v_gym, 'Hit',     v_today + 3);
  perform test_mk_sub(v_gym, 'Early',      v_today + 2);
  perform test_mk_sub(v_gym, 'Late',       v_today + 4);
  perform test_mk_sub(v_gym, 'Frozen',     v_today + 3, true);
  perform test_mk_sub(v_gym, 'Renewed',    v_today + 3, false, true);
  perform test_mk_sub(v_gym, 'Deleted',    v_today + 3, false, false, true);

  set local role authenticated;
  perform test_set_session('99999999-9999-9999-9999-999999999999', 'owner', v_gym::text);

  select count(*) into v_rows from public.reminders_due(v_gym, v_today);
  if v_rows <> 1 then
    raise exception 'FAIL Test 1a: expected exactly 1 due row, got %', v_rows;
  end if;

  select kind into v_kind from public.reminders_due(v_gym, v_today) where member_id = v_m_hit;
  if v_kind <> 'before_expiry' then
    raise exception 'FAIL Test 1b: boundary row kind % <> before_expiry', v_kind;
  end if;

  reset role;
  delete from public.gyms where id = v_gym;
  raise notice 'PASS Test 1: window boundary + excluded frozen/renewed/deleted';
end;
$$;

-- ============================================================
-- Test 2: expiry-day toggle + gym-timezone default date
-- ============================================================

do $$
declare
  v_gym      uuid := gen_random_uuid();
  v_m_expiry uuid;
  v_rows_ex  int;
  v_rows_no  int;
  v_today    date;
begin
  reset role;
  v_today := (now() at time zone 'Africa/Algiers')::date;

  insert into public.gyms (id, name, default_language, status, timezone)
  values (v_gym, 'Phase9 Toggle Gym', 'ar', 'active', 'Africa/Algiers');
  insert into public.gym_settings (gym_id, reminders_enabled, reminder_days_before, reminder_on_expiry_day, enabled_channels)
  values (v_gym, true, 3, false, '{whatsapp}');

  perform test_mk_sub(v_gym, 'Hit', v_today + 3);
  v_m_expiry := test_mk_sub(v_gym, 'ExpiryToday', v_today);

  set local role authenticated;
  perform test_set_session('99999999-9999-9999-9999-999999999999', 'owner', v_gym::text);

  -- toggle off: the expiry-day member is NOT due
  select count(*) into v_rows_no from public.reminders_due(v_gym, v_today) where member_id = v_m_expiry;
  if v_rows_no <> 0 then
    raise exception 'FAIL Test 2a: expiry-day member due while toggle off';
  end if;

  reset role;
  update public.gym_settings set reminder_on_expiry_day = true where gym_id = v_gym;

  set local role authenticated;
  perform test_set_session('99999999-9999-9999-9999-999999999999', 'owner', v_gym::text);

  select count(*) into v_rows_ex from public.reminders_due(v_gym, v_today);
  if v_rows_ex <> 2 then
    raise exception 'FAIL Test 2b: expected 2 due rows with toggle on, got %', v_rows_ex;
  end if;
  if not exists (
    select 1 from public.reminders_due(v_gym, v_today)
    where member_id = v_m_expiry and kind = 'expiry_day'
  ) then
    raise exception 'FAIL Test 2c: expiry-day row missing or wrong kind';
  end if;

  -- gym-timezone default date: omitting p_date equals passing today
  if (
    select count(*) from public.reminders_due(v_gym)
  ) <> (
    select count(*) from public.reminders_due(v_gym, v_today)
  ) then
    raise exception 'FAIL Test 2d: default date (gym tz) differs from explicit today';
  end if;

  reset role;
  delete from public.gyms where id = v_gym;
  raise notice 'PASS Test 2: expiry-day toggle + gym-timezone default date';
end;
$$;

-- ============================================================
-- Test 3: global off => empty set; cron idempotency
-- ============================================================

do $$
declare
  v_gym      uuid := gen_random_uuid();
  v_first    int;
  v_second   int;
  v_count    int;
  v_today    date;
begin
  reset role;
  v_today := (now() at time zone 'Africa/Algiers')::date;

  insert into public.gyms (id, name, default_language, status, timezone)
  values (v_gym, 'Phase9 Cron Gym', 'fr', 'active', 'Africa/Algiers');
  insert into public.gym_settings (gym_id, reminders_enabled, reminder_days_before, reminder_on_expiry_day, enabled_channels)
  values (v_gym, false, 3, true, '{whatsapp}');

  perform test_mk_sub(v_gym, 'Hit', v_today + 3);
  perform test_mk_sub(v_gym, 'ExpiryToday', v_today);

  set local role authenticated;
  perform test_set_session('99999999-9999-9999-9999-999999999999', 'owner', v_gym::text);

  -- global off => reminders_due empty
  if (select count(*) from public.reminders_due(v_gym, v_today)) <> 0 then
    raise exception 'FAIL Test 3a: reminders_due not empty while globally disabled';
  end if;

  reset role;
  update public.gym_settings set reminders_enabled = true where gym_id = v_gym;

  set local role authenticated;
  perform test_set_session('99999999-9999-9999-9999-999999999999', 'owner', v_gym::text);

  v_first  := public.insert_cron_reminders(v_gym, v_today);
  v_second := public.insert_cron_reminders(v_gym, v_today);

  if v_first <> 2 then
    raise exception 'FAIL Test 3b: first cron insert expected 2, got %', v_first;
  end if;
  if v_second <> 0 then
    raise exception 'FAIL Test 3c: second cron insert expected 0 (idempotent), got %', v_second;
  end if;

  select count(*) into v_count from public.reminders
  where gym_id = v_gym and kind <> 'manual';
  if v_count <> 2 then
    raise exception 'FAIL Test 3d: expected 2 cron rows total, got %', v_count;
  end if;

  reset role;
  delete from public.gyms where id = v_gym;
  raise notice 'PASS Test 3: global off empty + double-cron no duplicates';
end;
$$;

-- ============================================================
-- Test 4: manual log — status/kind, REMINDERS_DISABLED, ALREADY_SENT
-- ============================================================

do $$
declare
  v_gym     uuid := gen_random_uuid();
  v_member  uuid;
  v_row     public.reminders;
  v_today   date;
  v_blocked text;
begin
  reset role;
  v_today := (now() at time zone 'Africa/Algiers')::date;

  insert into public.gyms (id, name, default_language, status, timezone)
  values (v_gym, 'Phase9 Manual Gym', 'fr', 'active', 'Africa/Algiers');
  insert into public.gym_settings (gym_id, reminders_enabled, reminder_days_before, reminder_on_expiry_day, enabled_channels)
  values (v_gym, true, 3, false, '{whatsapp}');

  v_member := test_mk_sub(v_gym, 'Manual', v_today + 3);

  -- Use the seeded owner A uid: created_by has an FK to auth.users(id).
  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym::text);

  v_row := public.log_manual_reminder(
    gen_random_uuid(), v_gym, v_member, null, 'whatsapp', 'fr',
    'Cher Manual, votre abonnement expire bientôt.', v_today
  );
  if v_row.kind <> 'manual' or v_row.status <> 'sent' or v_row.created_by is null then
    raise exception 'FAIL Test 4a: manual row kind/status/created_by wrong (% / % / %)',
      v_row.kind, v_row.status, v_row.created_by;
  end if;

  -- same member + same day, different id => ALREADY_SENT
  begin
    perform public.log_manual_reminder(
      gen_random_uuid(), v_gym, v_member, null, 'sms', 'fr', 'dup', v_today
    );
    raise exception 'FAIL Test 4b: duplicate manual send did not raise';
  exception
    when others then
      v_blocked := sqlerrm;
      if position('ALREADY_SENT' in v_blocked) = 0 then
        raise exception 'FAIL Test 4c: expected ALREADY_SENT, got %', v_blocked;
      end if;
  end;

  -- disabled gym => REMINDERS_DISABLED
  reset role;
  update public.gym_settings set reminders_enabled = false where gym_id = v_gym;

  set local role authenticated;
  perform test_set_session('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', v_gym::text);
  begin
    perform public.log_manual_reminder(
      gen_random_uuid(), v_gym, v_member, null, 'whatsapp', 'fr', 'nope', v_today
    );
    raise exception 'FAIL Test 4d: logging while disabled did not raise';
  exception
    when others then
      v_blocked := sqlerrm;
      if position('REMINDERS_DISABLED' in v_blocked) = 0 then
        raise exception 'FAIL Test 4e: expected REMINDERS_DISABLED, got %', v_blocked;
      end if;
  end;

  reset role;
  delete from public.gyms where id = v_gym;
  raise notice 'PASS Test 4: manual log guards + status + ALREADY_SENT';
end;
$$;

-- ============================================================
-- Test 5: render_reminder + validate_reminder_body
-- ============================================================

do $$
declare
  v_rendered text;
  v_blocked  text;
begin
  v_rendered := public.render_reminder('Hi {memberName} {endDate} {gymName}', 'Karim', '2026-01-15', 'Club');
  if v_rendered <> 'Hi Karim 15/01/2026 Club' then
    raise exception 'FAIL Test 5a: render_reminder = %', v_rendered;
  end if;

  perform public.validate_reminder_body('Bonjour {memberName} {endDate} {gymName}');

  begin
    perform public.validate_reminder_body('Bad {unknownVar}');
    raise exception 'FAIL Test 5b: unknown variable accepted';
  exception
    when others then
      v_blocked := sqlerrm;
      if position('INVALID_TEMPLATE' in v_blocked) = 0 then
        raise exception 'FAIL Test 5c: expected INVALID_TEMPLATE, got %', v_blocked;
      end if;
  end;

  begin
    perform public.validate_reminder_body('   ');
    raise exception 'FAIL Test 5d: empty body accepted';
  exception
    when others then
      v_blocked := sqlerrm;
      if position('INVALID_TEMPLATE' in v_blocked) = 0 then
        raise exception 'FAIL Test 5e: expected INVALID_TEMPLATE, got %', v_blocked;
      end if;
  end;

  raise notice 'PASS Test 5: render_reminder + validate_reminder_body';
end;
$$;

\echo '=== All Phase 9 tests PASSED ==='

drop function if exists test_set_session(text, text, text);
drop function if exists test_mk_sub(uuid, text, date, boolean, boolean, boolean);
