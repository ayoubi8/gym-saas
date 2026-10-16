-- ============================================================
-- 0003_phase3_hardening.sql
-- Phase 3 — Members, plans, subscriptions.
--
-- Two tenant-isolation fixes on the landed 1A schema, plus RPC
-- guards required by the Phase 3 DATA-CONTRACT. No table changes
-- (columns, indexes and policy names are unchanged); only:
--   1. Views -> security_invoker so underlying RLS applies to the
--      caller instead of the view owner (postgres).
--   2. RLS helpers -> read public.profiles instead of the
--      user-editable auth user_metadata.
--   3. normalize_dz_phone() + server-side normalization in the
--      member RPCs.
--   4. renew/pause/resume/extend guards.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Views must run with the caller's privileges, otherwise they
--    are owned by postgres (RLS-bypassing owner) and leak every
--    gym's rows to any authenticated owner.
-- ------------------------------------------------------------

alter view public.member_current_subscription set (security_invoker = on);
alter view public.member_status               set (security_invoker = on);
alter view public.subscription_balance        set (security_invoker = on);
alter view public.member_balance              set (security_invoker = on);

-- ------------------------------------------------------------
-- 2. RLS helpers: derive identity from public.profiles (authoritative,
--    not client-writable) keyed on auth.uid().
--    SECURITY DEFINER so the lookup itself is not filtered by the
--    profiles RLS policy (avoids recursion via is_admin()).
-- ------------------------------------------------------------

create or replace function public.current_gym_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.gym_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns bool language sql stable security definer set search_path = public as $$
  select coalesce((select p.role = 'admin' from public.profiles p where p.id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- 3. normalize_dz_phone(text) — SQL mirror of
--    apps/web/src/lib/phone.ts and supabase/functions/_shared/phone.ts.
--    Returns +213XXXXXXXXX or null when the input is not a valid
--    Algerian number.
-- ------------------------------------------------------------

create or replace function public.normalize_dz_phone(p_raw text)
returns text language plpgsql immutable set search_path = public as $$
declare
  s        text;
  digits   text;
  national text;
begin
  if p_raw is null then
    return null;
  end if;

  -- Arabic-Indic (U+0660..) and Eastern-Arabic/Persian (U+06F0..) digits -> ASCII
  s := translate(p_raw,
        '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        '01234567890123456789');
  s := replace(s, chr(160), '');            -- non-breaking space
  s := regexp_replace(s, '[[:space:]().-]', '', 'g');

  if left(s, 1) = '+' then
    s := substr(s, 2);
  end if;
  if left(s, 2) = '00' then
    s := substr(s, 3);
  end if;

  digits := regexp_replace(s, '[^0-9]', '', 'g');
  if digits = '' then
    return null;
  end if;

  national := digits;
  if left(national, 3) = '213' then
    national := substr(national, 4);
  elsif left(national, 1) = '0' then
    national := regexp_replace(national, '^0+', '');
  end if;

  -- Mobile: 9 digits starting 5/6/7 ; landline: 8 digits starting 2/3/4
  if length(national) = 9 and position(left(national, 1) in '567') > 0 then
    return '+213' || national;
  end if;
  if length(national) = 8 and position(left(national, 1) in '234') > 0 then
    return '+213' || national;
  end if;

  return null;
end;
$$;

-- ------------------------------------------------------------
-- 4. Member RPCs — normalize phone server-side (DATA-CONTRACT 08),
--    reject unusable numbers with INVALID_PHONE.
-- ------------------------------------------------------------

create or replace function public.create_member(
  p_id        uuid,
  p_gym_id    uuid,
  p_full_name text,
  p_phone     text,
  p_language  public.lang default null
) returns public.members language plpgsql security invoker as $$
declare
  v_member public.members;
  v_phone  text;
begin
  v_phone := public.normalize_dz_phone(p_phone);
  if v_phone is null then
    raise exception 'INVALID_PHONE' using
      hint = 'Not a valid Algerian phone number.',
      errcode = 'P0001';
  end if;

  insert into public.members (id, gym_id, full_name, phone, language, created_by)
  values (p_id, p_gym_id, p_full_name, v_phone, p_language, auth.uid())
  on conflict (id) do nothing
  returning * into v_member;

  if v_member.id is null then
    -- idempotent: already exists
    select * into v_member from public.members where id = p_id;
  end if;
  return v_member;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PHONE' using
      hint = 'A member with this phone number already exists in this gym.',
      errcode = 'P0001';
end;
$$;

create or replace function public.update_member(
  p_id        uuid,
  p_full_name text,
  p_phone     text,
  p_language  public.lang default null
) returns public.members language plpgsql security invoker as $$
declare
  v_member public.members;
  v_phone  text;
begin
  v_phone := public.normalize_dz_phone(p_phone);
  if v_phone is null then
    raise exception 'INVALID_PHONE' using
      hint = 'Not a valid Algerian phone number.',
      errcode = 'P0001';
  end if;

  update public.members
  set full_name  = p_full_name,
      phone      = v_phone,
      language   = p_language,
      updated_at = now()
  where id = p_id
    and gym_id = public.current_gym_id()
    and deleted_at is null
  returning * into v_member;

  if v_member.id is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return v_member;
exception
  when unique_violation then
    raise exception 'DUPLICATE_PHONE' using
      hint = 'A member with this phone number already exists in this gym.',
      errcode = 'P0001';
end;
$$;

-- ------------------------------------------------------------
-- 5. renew_subscription — refuse when the current subscription
--    already has a live successor (double renewal / stale UI).
-- ------------------------------------------------------------

create or replace function public.renew_subscription(
  p_id            uuid,
  p_gym_id        uuid,
  p_member_id     uuid,
  p_plan_id       uuid,
  p_first_payment jsonb default null
) returns public.subscriptions language plpgsql security invoker as $$
declare
  v_current public.subscriptions;
  v_plan    public.plans;
  v_start   date;
  v_end     date;
  v_sub     public.subscriptions;
  v_tz      text;
  v_today   date;
begin
  select coalesce(timezone, 'Africa/Algiers') into v_tz
  from public.gyms where id = p_gym_id;
  v_today := (now() at time zone v_tz)::date;

  -- Find current subscription
  select * into v_current
  from public.member_current_subscription
  where member_id = p_member_id;

  if v_current.id is not null and exists (
    select 1 from public.subscriptions s
    where s.member_id = p_member_id
      and s.cancelled_at is null
      and s.renewed_from_id = v_current.id
  ) then
    raise exception 'ALREADY_RENEWED' using
      hint = 'This subscription has already been renewed.',
      errcode = 'P0001';
  end if;

  -- Start day after current end_date, or today if expired/no subscription
  if v_current.id is not null and v_current.end_date >= v_today then
    v_start := v_current.end_date + 1;
  else
    v_start := v_today;
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  v_end := public.derive_end_date(v_plan.type, v_start,
                                   v_plan.duration_months, v_plan.validity_days);

  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, sessions_total, sessions_remaining,
    renewed_from_id, created_by
  )
  values (
    p_id, p_gym_id, p_member_id, p_plan_id, v_plan.name, v_plan.type,
    v_plan.price_dzd, v_start, v_end,
    v_plan.session_count, v_plan.session_count,
    v_current.id, auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_sub;

  if v_sub.id is null then
    select * into v_sub from public.subscriptions where id = p_id;
  end if;

  if p_first_payment is not null then
    perform public.record_payment(
      (p_first_payment->>'id')::uuid,
      v_sub.id,
      (p_first_payment->>'amount_dzd')::int,
      coalesce((p_first_payment->>'paid_on')::date, current_date),
      coalesce((p_first_payment->>'method')::public.payment_method, 'cash'),
      p_first_payment->>'note'
    );
  end if;

  return v_sub;
end;
$$;

-- ------------------------------------------------------------
-- 6. pause_subscription — one open pause at a time with a clean
--    error code (the pauses_open_uidx index also enforces this).
-- ------------------------------------------------------------

create or replace function public.pause_subscription(
  p_id              uuid,
  p_subscription_id uuid,
  p_gym_id          uuid,
  p_start_date      date,
  p_reason          public.pause_reason,
  p_note            text default null,
  p_planned_end     date default null
) returns public.pauses language plpgsql security invoker as $$
declare
  v_pause public.pauses;
begin
  if exists (
    select 1 from public.pauses p
    where p.subscription_id = p_subscription_id
      and p.resumed_on is null
  ) then
    raise exception 'PAUSE_ALREADY_OPEN' using
      hint = 'This subscription is already paused.',
      errcode = 'P0001';
  end if;

  insert into public.pauses (
    id, gym_id, subscription_id, start_date, planned_end_date,
    reason, note, created_by
  )
  values (
    p_id, p_gym_id, p_subscription_id, p_start_date, p_planned_end,
    p_reason, p_note, auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_pause;

  if v_pause.id is null then
    select * into v_pause from public.pauses where id = p_id;
  end if;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id, new_value
  )
  values (
    p_gym_id, auth.uid(), 'pause_subscription', 'pause', v_pause.id,
    to_jsonb(v_pause)
  );

  return v_pause;
end;
$$;

-- ------------------------------------------------------------
-- 7. resume_subscription — resume date cannot precede the pause start.
-- ------------------------------------------------------------

create or replace function public.resume_subscription(
  p_pause_id   uuid,
  p_resumed_on date
) returns public.subscriptions language plpgsql security invoker as $$
declare
  v_pause public.pauses;
  v_days  int;
  v_sub   public.subscriptions;
begin
  select * into v_pause from public.pauses where id = p_pause_id;
  if not found then raise exception 'PAUSE_NOT_FOUND'; end if;
  if v_pause.resumed_on is not null then raise exception 'ALREADY_RESUMED'; end if;

  if p_resumed_on < v_pause.start_date then
    raise exception 'RESUME_BEFORE_START' using
      hint = 'Resume date cannot be before the pause start date.',
      errcode = 'P0001';
  end if;

  v_days := p_resumed_on - v_pause.start_date;

  -- Mark pause as resumed
  update public.pauses
  set resumed_on = p_resumed_on,
      days_added = v_days,
      resumed_by = auth.uid()
  where id = p_pause_id;

  -- Extend subscription end_date by paused days
  update public.subscriptions
  set end_date   = end_date + v_days,
      updated_at = now()
  where id = v_pause.subscription_id
  returning * into v_sub;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id, new_value, reason
  )
  values (
    v_pause.gym_id, auth.uid(), 'resume_subscription', 'pause', p_pause_id,
    jsonb_build_object('days_added', v_days, 'new_end_date', v_sub.end_date),
    'resume after ' || v_days || ' days paused'
  );

  return v_sub;
end;
$$;

-- ------------------------------------------------------------
-- 8. extend_subscription — days must be a positive integer.
-- ------------------------------------------------------------

create or replace function public.extend_subscription(
  p_id              uuid,
  p_gym_id          uuid,
  p_subscription_id uuid,
  p_days            int,
  p_reason          public.extension_reason,
  p_note            text default null
) returns public.subscriptions language plpgsql security invoker as $$
declare
  v_ext public.extensions;
  v_sub public.subscriptions;
begin
  if p_days is null or p_days <= 0 then
    raise exception 'INVALID_DAYS' using
      hint = 'Extension days must be a positive number.',
      errcode = 'P0001';
  end if;

  insert into public.extensions (id, gym_id, subscription_id, days_added, reason, note, created_by)
  values (p_id, p_gym_id, p_subscription_id, p_days, p_reason, p_note, auth.uid())
  on conflict (id) do nothing
  returning * into v_ext;

  if v_ext.id is null then
    select * into v_ext from public.extensions where id = p_id;
  end if;

  update public.subscriptions
  set end_date   = end_date + p_days,
      updated_at = now()
  where id = p_subscription_id
  returning * into v_sub;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id, new_value, reason
  )
  values (
    p_gym_id, auth.uid(), 'extend_subscription', 'extension', v_ext.id,
    jsonb_build_object('days_added', p_days, 'new_end_date', v_sub.end_date),
    p_reason::text || coalesce(' — ' || p_note, '')
  );

  return v_sub;
end;
$$;
