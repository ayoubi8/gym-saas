-- 0008_phase9_reminders.sql — Phase 9 (PRD §5.4 / §5.8, docs/plans/09-reminders.md).
--
-- Additive only (AGENTS.md §12): this file never edits a landed migration; it
-- redefines a few Phase 2 stubs in place with `create or replace`.
--
-- What lands here:
--   1. manual idempotency: at most one manual reminder per member per day
--      (decision A) — the Phase 2 cron index explicitly excluded `manual`.
--   2. render_reminder() + validate_reminder_body() — single source for the
--      {memberName} {endDate} {gymName} variables the template editors validate.
--   3. reminders_due() redefined: gym-timezone "today" when p_date is omitted.
--   4. insert_cron_reminders() — the idempotent cron writer (called by the
--      reminders-sender Edge Function): due set -> pending rows, ON CONFLICT
--      DO NOTHING on the non-manual unique index. Kept in SQL so the partial
--      index can be targeted (PostgREST cannot express a partial ON CONFLICT).
--   5. log_manual_reminder() redefined: gym/active/reminders-enabled guards,
--      ALREADY_SENT on the manual index, replay-safe on the client id.
--   6. upsert_reminder_template() redefined: variable validation + audit.
--   7. update_gym_settings() redefined: SECURITY DEFINER so it can persist
--      gyms.default_language (owners only SELECT gyms), plus audit (decision C).
--
-- Decision D (recorded in PROGRESS.md): a real gateway is out of MVP scope, so
-- `sendReminder()` stays a no-op and cron rows remain `pending` ("to send").
-- `sent`/`delivered`/`failed` are reserved for a future gateway. Manual rows
-- are stored `status='sent'` as "opened in the channel" and the UI never shows
-- the word "sent" for them (see lib/reminder-template.ts#reminderStatusKey).

-- ============================================================
-- 1. Manual idempotency (decision A)
-- ============================================================
-- One manual reminder per member per scheduled day. The member-facing UI shows
-- "Opened in WhatsApp" — replaying the same tap the same day raises ALREADY_SENT.

create unique index if not exists reminders_manual_uidx
  on public.reminders (member_id, kind, scheduled_for)
  where kind = 'manual';

-- ============================================================
-- 2a. render_reminder(body, member_name, end_date, gym_name)
-- ============================================================
-- Mirrors apps/web/src/lib/reminder-template.ts#renderReminderBody. Dates are
-- rendered DD/MM/YYYY (locale-neutral for the stored cron body; the client
-- renders its own locale-aware body for the manual path).

create or replace function public.render_reminder(
  p_body        text,
  p_member_name text,
  p_end_date    date,
  p_gym_name    text
) returns text language sql stable set search_path = public as $$
  select replace(
           replace(
             replace(coalesce(p_body, ''), '{memberName}', coalesce(p_member_name, '')),
             '{endDate}', to_char(p_end_date, 'DD/MM/YYYY')
           ),
           '{gymName}', coalesce(p_gym_name, '')
         );
$$;

-- ============================================================
-- 2b. validate_reminder_body(body) — reject unknown {variables}
-- ============================================================

create or replace function public.validate_reminder_body(p_body text)
returns void language plpgsql immutable set search_path = public as $$
declare
  v_stripped text;
begin
  if p_body is null or btrim(p_body) = '' then
    raise exception 'INVALID_TEMPLATE' using
      hint = 'Template body must not be empty', errcode = 'P0001';
  end if;

  v_stripped := replace(
                  replace(
                    replace(p_body, '{memberName}', ''),
                    '{endDate}', ''
                  ),
                  '{gymName}', ''
                );

  if v_stripped ~ '\{[A-Za-z][A-Za-z0-9_]*\}' then
    raise exception 'INVALID_TEMPLATE' using
      hint = 'Unknown template variable — allowed: {memberName} {endDate} {gymName}',
      errcode = 'P0001';
  end if;
end;
$$;

-- ============================================================
-- 3. reminders_due(p_gym_id, p_date) — gym-timezone "today"
-- ============================================================
-- Same signature (p_date gains a default) so the generated types stay valid.
-- When p_date is null the gym's timezone decides "today" (Africa/Algiers by
-- default). Exclusions unchanged: frozen, already-renewed, cancelled,
-- soft-deleted, reminders disabled.

create or replace function public.reminders_due(
  p_gym_id uuid,
  p_date   date default null
) returns table (
  member_id       uuid,
  subscription_id uuid,
  end_date        date,
  full_name       text,
  phone           text,
  language        public.lang,
  kind            public.reminder_kind
) language plpgsql security invoker set search_path = public as $$
declare
  v_days_before int;
  v_on_expiry   bool;
  v_enabled     bool;
  v_date        date;
  v_tz          text;
begin
  select
    coalesce(gs.reminder_days_before, 3),
    coalesce(gs.reminder_on_expiry_day, false),
    coalesce(gs.reminders_enabled, true)
  into v_days_before, v_on_expiry, v_enabled
  from public.gym_settings gs
  where gs.gym_id = p_gym_id;

  if not v_enabled then
    return;
  end if;

  select g.timezone into v_tz from public.gyms g where g.id = p_gym_id;
  v_date := coalesce(p_date, (now() at time zone coalesce(v_tz, 'Africa/Algiers'))::date);

  return query
  select
    m.id,
    mcs.id,
    mcs.end_date,
    m.full_name,
    m.phone,
    coalesce(m.language, (select g.default_language from public.gyms g where g.id = p_gym_id)),
    case
      when mcs.end_date = v_date then 'expiry_day'::public.reminder_kind
      else 'before_expiry'::public.reminder_kind
    end
  from public.member_current_subscription mcs
  join public.members m on m.id = mcs.member_id
  where
    mcs.gym_id = p_gym_id
    and m.deleted_at is null
    and mcs.cancelled_at is null
    and not exists (
      select 1 from public.pauses p
      where p.subscription_id = mcs.id and p.resumed_on is null
    )
    and not exists (
      select 1 from public.subscriptions s2
      where s2.member_id = mcs.member_id
        and s2.id <> mcs.id
        and s2.cancelled_at is null
        and s2.created_at > mcs.created_at
    )
    and (
      (mcs.end_date = v_date + v_days_before)
      or (v_on_expiry and mcs.end_date = v_date)
    );
end;
$$;

-- ============================================================
-- 4. insert_cron_reminders(p_gym_id, p_date) — idempotent cron writer
-- ============================================================
-- The reminders-sender Edge Function calls this once per gym. It resolves the
-- due set, renders each body (decision B: body_rendered is written at insert),
-- uses the gym's first enabled channel, and inserts `pending` rows. Reruns are
-- no-ops thanks to reminders_cron_uidx. Returns the number of rows inserted.
-- Rows stay `pending` (decision D: no gateway, `sendReminder()` is a no-op).

create or replace function public.insert_cron_reminders(
  p_gym_id uuid,
  p_date   date default null
) returns int language plpgsql security invoker set search_path = public as $$
declare
  v_date       date;
  v_tz         text;
  v_gym_name   text;
  v_default_ar text := 'تذكير: {memberName}، اشتراكك في {gymName} ينتهي في {endDate}. يرجى التجديد.';
  v_default_fr text := 'Rappel : {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.';
  v_count      int;
begin
  select g.name, g.timezone into v_gym_name, v_tz
  from public.gyms g where g.id = p_gym_id;

  if v_gym_name is null then
    return 0;
  end if;

  v_date := coalesce(p_date, (now() at time zone coalesce(v_tz, 'Africa/Algiers'))::date);

  insert into public.reminders (
    gym_id, member_id, subscription_id, kind, channel, language,
    body_rendered, status, scheduled_for, created_by
  )
  select
    p_gym_id,
    d.member_id,
    d.subscription_id,
    d.kind,
    coalesce(gs.enabled_channels[1], 'whatsapp'::public.channel),
    d.language,
    public.render_reminder(
      coalesce(t.body, case when d.language = 'ar' then v_default_ar else v_default_fr end),
      d.full_name,
      d.end_date,
      v_gym_name
    ),
    'pending',
    v_date,
    null
  from public.reminders_due(p_gym_id, v_date) d
  left join public.gym_settings gs on gs.gym_id = p_gym_id
  left join public.reminder_templates t
    on t.gym_id = p_gym_id and t.language = d.language and t.kind = d.kind
  on conflict (subscription_id, kind, scheduled_for) where kind <> 'manual' do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- 5. log_manual_reminder — guards + ALREADY_SENT + replay-safe
-- ============================================================
-- Same signature as Phase 2. Owner one-tap send logs kind='manual' rows. The
-- UI labels these "Opened in {channel}", never "sent".

create or replace function public.log_manual_reminder(
  p_id              uuid,
  p_gym_id          uuid,
  p_member_id       uuid,
  p_subscription_id uuid,
  p_channel         public.channel,
  p_language        public.lang,
  p_body_rendered   text,
  p_scheduled_for   date
) returns public.reminders language plpgsql security invoker set search_path = public as $$
declare
  v_r         public.reminders;
  v_enabled   bool;
  v_member_gym uuid;
  v_role      text := coalesce(auth.role(), '');
begin
  if v_role <> 'service_role' then
    if not (public.is_admin() or p_gym_id = public.current_gym_id()) then
      raise exception 'RLS_DENIED' using errcode = '42501';
    end if;
    if not public.gym_is_active() and not public.is_admin() then
      raise exception 'SUSPENDED_GYM' using errcode = 'P0001';
    end if;
  end if;

  select coalesce(gs.reminders_enabled, true) into v_enabled
  from public.gym_settings gs where gs.gym_id = p_gym_id;

  if v_enabled is false then
    raise exception 'REMINDERS_DISABLED' using errcode = 'P0001';
  end if;

  select m.gym_id into v_member_gym from public.members m where m.id = p_member_id;
  if v_member_gym is distinct from p_gym_id then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.reminders (
    id, gym_id, member_id, subscription_id, kind, channel, language,
    body_rendered, status, scheduled_for, sent_at, created_by
  )
  values (
    p_id, p_gym_id, p_member_id, p_subscription_id, 'manual', p_channel, p_language,
    p_body_rendered, 'sent', p_scheduled_for, now(), auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_r;

  if v_r.id is null then
    -- Same client id replayed (idempotent retry): return the existing row.
    select * into v_r from public.reminders where id = p_id;
  end if;

  return v_r;
exception
  when unique_violation then
    -- reminders_manual_uidx: already opened a reminder for this member today.
    raise exception 'ALREADY_SENT' using errcode = 'P0001';
end;
$$;

-- ============================================================
-- 6. upsert_reminder_template — variable validation + audit
-- ============================================================
-- Keeps RLS (invoker): reminder_templates_owner_write allows the owner's gym.

create or replace function public.upsert_reminder_template(
  p_id       uuid,
  p_gym_id   uuid,
  p_language public.lang,
  p_kind     public.reminder_kind,
  p_body     text
) returns public.reminder_templates language plpgsql security invoker set search_path = public as $$
declare
  v_tpl public.reminder_templates;
  v_old public.reminder_templates;
  v_role text := coalesce(auth.role(), '');
begin
  if v_role <> 'service_role' and not (public.is_admin() or p_gym_id = public.current_gym_id()) then
    raise exception 'RLS_DENIED' using errcode = '42501';
  end if;

  perform public.validate_reminder_body(p_body);

  select * into v_old
  from public.reminder_templates
  where gym_id = p_gym_id and language = p_language and kind = p_kind;

  insert into public.reminder_templates (id, gym_id, language, kind, body)
  values (p_id, p_gym_id, p_language, p_kind, p_body)
  on conflict (gym_id, language, kind) do update set
    body       = excluded.body,
    updated_at = now()
  returning * into v_tpl;

  insert into public.audit_log (gym_id, actor_id, action, entity_type, entity_id, old_value, new_value)
  values (
    p_gym_id, auth.uid(), 'upsert_reminder_template', 'reminder_template', v_tpl.id,
    to_jsonb(v_old), to_jsonb(v_tpl)
  );

  return v_tpl;
end;
$$;

-- ============================================================
-- 7. update_gym_settings — SECURITY DEFINER + default_language + audit
-- ============================================================
-- Owners have SELECT-only on gyms, so persisting gyms.default_language (the
-- gym-wide reminder language default) needs a DEFINER function. The explicit
-- gym/active check replaces the RLS the DEFINER bypasses (decision C).
--
-- The Phase 2 function had a 6-arg signature; adding p_default_language is a
-- new signature, so drop the old one first (no dependency) to avoid an overload.

drop function if exists public.update_gym_settings(
  uuid, boolean, integer, boolean, public.channel[], boolean
);

create or replace function public.update_gym_settings(
  p_gym_id                 uuid,
  p_reminders_enabled      bool,
  p_reminder_days_before   int,
  p_reminder_on_expiry_day bool,
  p_enabled_channels       public.channel[],
  p_onboarding_completed   bool default null,
  p_default_language       public.lang default null
) returns public.gym_settings language plpgsql security definer set search_path = public as $$
declare
  v_settings public.gym_settings;
  v_old      public.gym_settings;
  v_old_lang public.lang;
  v_role     text := coalesce(auth.role(), '');
begin
  if v_role <> 'service_role' then
    if not (public.is_admin() or p_gym_id = public.current_gym_id()) then
      raise exception 'RLS_DENIED' using errcode = '42501';
    end if;
    if not public.gym_is_active() and not public.is_admin() then
      raise exception 'SUSPENDED_GYM' using errcode = 'P0001';
    end if;
  end if;

  if p_reminder_days_before is null or p_reminder_days_before < 1 or p_reminder_days_before > 30 then
    raise exception 'DAYS_OUT_OF_RANGE' using errcode = 'P0001';
  end if;

  if p_enabled_channels is null or array_length(p_enabled_channels, 1) is null then
    raise exception 'INVALID_INPUT' using errcode = 'P0001';
  end if;

  select * into v_old from public.gym_settings where gym_id = p_gym_id;
  select default_language into v_old_lang from public.gyms where id = p_gym_id;

  insert into public.gym_settings (
    gym_id, reminders_enabled, reminder_days_before,
    reminder_on_expiry_day, enabled_channels
  )
  values (
    p_gym_id, p_reminders_enabled, p_reminder_days_before,
    p_reminder_on_expiry_day, p_enabled_channels
  )
  on conflict (gym_id) do update set
    reminders_enabled      = excluded.reminders_enabled,
    reminder_days_before   = excluded.reminder_days_before,
    reminder_on_expiry_day = excluded.reminder_on_expiry_day,
    enabled_channels       = excluded.enabled_channels,
    onboarding_completed   = coalesce(p_onboarding_completed, gym_settings.onboarding_completed),
    updated_at             = now()
  returning * into v_settings;

  if p_default_language is not null then
    update public.gyms
    set default_language = p_default_language, updated_at = now()
    where id = p_gym_id;
  end if;

  insert into public.audit_log (gym_id, actor_id, action, entity_type, entity_id, old_value, new_value)
  values (
    p_gym_id, auth.uid(), 'update_gym_settings', 'gym_settings', p_gym_id,
    coalesce(to_jsonb(v_old), '{}'::jsonb) || jsonb_build_object('default_language', v_old_lang),
    to_jsonb(v_settings) || jsonb_build_object('default_language', coalesce(p_default_language, v_old_lang))
  );

  return v_settings;
end;
$$;
