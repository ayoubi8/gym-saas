-- 0002_core_schema.sql
-- Phase 1A: full schema per docs/DATA-MODEL.md
-- Enums, 17 tables, views, RPCs, RLS, receipt_counters
-- Duration rule: calendar months (DATA-MODEL.md wins over AGENTS §5.4 day counts; R1 decided 2026-10-14)
-- DO NOT EDIT this landed migration; future changes go in a new file.

-- ============================================================
-- Extensions
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ============================================================
-- Drop starter tables (replaced with full schema)
-- ============================================================

drop table if exists public.profiles cascade;
drop table if exists public.gyms cascade;

-- ============================================================
-- Enums
-- ============================================================

do $$ begin
  create type public.role_type as enum ('admin', 'owner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.gym_status as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lang as enum ('ar', 'fr');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_type as enum ('monthly', 'quarterly', 'semiannual', 'annual', 'per_session', 'class_pack');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('cash', 'bank_transfer', 'ccp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pause_reason as enum ('travel', 'injury', 'ramadan', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.extension_reason as enum ('compensation', 'promotion', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.channel as enum ('whatsapp', 'sms', 'viber');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_kind as enum ('before_expiry', 'expiry_day', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reminder_status as enum ('pending', 'sent', 'delivered', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_status as enum ('uploaded', 'mapped', 'previewed', 'committed', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_row_status as enum ('valid', 'error', 'duplicate', 'imported', 'skipped', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.duplicate_policy as enum ('skip', 'update');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Table 1: gyms
-- ============================================================

create table public.gyms (
  id                uuid        primary key default gen_random_uuid(),
  name              text        not null,
  city              text,
  default_language  public.lang not null default 'ar',
  timezone          text        not null default 'Africa/Algiers',
  status            public.gym_status not null default 'active',
  suspended_at      timestamptz,
  created_by        uuid        references auth.users(id),  -- admin actor
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ============================================================
-- Table 2: profiles (auth.users.id as PK)
-- ============================================================

create table public.profiles (
  id           uuid          primary key references auth.users(id) on delete cascade,
  gym_id       uuid          references public.gyms(id),
  role         public.role_type not null,
  full_name    text          not null,
  phone        text,          -- normalized +213..., nullable
  email        text,          -- nullable (synthetic email for phone logins)
  language     public.lang   not null default 'ar',
  last_seen_at timestamptz,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now(),
  -- admin: gym_id null; owner: gym_id required
  constraint profiles_role_gym_ck check (
    (role = 'admin' and gym_id is null) or
    (role = 'owner' and gym_id is not null)
  ),
  -- at least one contact identifier
  constraint profiles_contact_ck check (phone is not null or email is not null)
);

-- ============================================================
-- Table 3: gym_settings (one row per gym)
-- ============================================================

create table public.gym_settings (
  gym_id                  uuid        primary key references public.gyms(id) on delete cascade,
  reminders_enabled       bool        not null default true,
  reminder_days_before    int         not null default 3 check (reminder_days_before between 1 and 30),
  reminder_on_expiry_day  bool        not null default false,
  enabled_channels        public.channel[] not null default '{whatsapp}',
  onboarding_completed    bool        not null default false,
  updated_at              timestamptz not null default now()
);

-- ============================================================
-- Table 4: reminder_templates
-- ============================================================

create table public.reminder_templates (
  id         uuid             primary key default gen_random_uuid(),
  gym_id     uuid             not null references public.gyms(id) on delete cascade,
  language   public.lang      not null,
  kind       public.reminder_kind not null check (kind in ('before_expiry', 'expiry_day')),
  body       text             not null,  -- {memberName} {endDate} {gymName}
  created_at timestamptz      not null default now(),
  updated_at timestamptz      not null default now(),
  unique (gym_id, language, kind)
);

-- ============================================================
-- Table 5: members
-- ============================================================

create table public.members (
  id          uuid         primary key default gen_random_uuid(),
  gym_id      uuid         not null references public.gyms(id) on delete cascade,
  full_name   text         not null,
  phone       text         not null,  -- normalized +213...
  language    public.lang,            -- per-member override; null = use gym default
  created_by  uuid         references auth.users(id),
  created_at  timestamptz  not null default now(),
  updated_at  timestamptz  not null default now(),
  deleted_at  timestamptz             -- soft delete
);

-- Partial unique: phone unique per active (non-deleted) member per gym
create unique index members_gym_phone_active_uidx
  on public.members (gym_id, phone)
  where deleted_at is null;

-- Trigram index for full-name search
create index members_full_name_trgm_idx
  on public.members using gin (full_name gin_trgm_ops);

-- Btree index for phone lookups
create index members_gym_phone_idx
  on public.members (gym_id, phone);

-- ============================================================
-- Table 6: plans
-- ============================================================

create table public.plans (
  id              uuid             primary key default gen_random_uuid(),
  gym_id          uuid             not null references public.gyms(id) on delete cascade,
  name            text             not null,
  type            public.plan_type not null,
  duration_months int,   -- 1|3|6|12 for time-based plans (calendar months)
  session_count   int,   -- per_session=1, class_pack=N
  validity_days   int,   -- session-plan window (default: per_session=1, class_pack=60)
  price_dzd       int    not null check (price_dzd >= 0),
  active          bool   not null default true,
  created_by      uuid   references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- per-type consistency
  constraint plans_time_ck check (
    type not in ('monthly','quarterly','semiannual','annual')
    or (duration_months is not null and session_count is null)
  ),
  constraint plans_session_ck check (
    type not in ('per_session','class_pack')
    or (session_count is not null and validity_days is not null and duration_months is null)
  )
);

-- ============================================================
-- Table 7: subscriptions
-- ============================================================

create table public.subscriptions (
  id                    uuid             primary key default gen_random_uuid(),
  gym_id                uuid             not null references public.gyms(id) on delete cascade,
  member_id             uuid             not null references public.members(id),
  plan_id               uuid             references public.plans(id),
  plan_name_snapshot    text             not null,       -- copied from plan at assignment
  plan_type_snapshot    public.plan_type not null,
  price_dzd             int              not null check (price_dzd >= 0),  -- snapshot
  start_date            date             not null,
  end_date              date,                            -- null for pure session packs without validity_days
  sessions_total        int,                             -- null for time plans
  sessions_remaining    int  check (sessions_remaining >= 0),
  renewed_from_id       uuid             references public.subscriptions(id),
  cancelled_at          timestamptz,
  created_by            uuid             references auth.users(id),
  created_at            timestamptz      not null default now(),
  updated_at            timestamptz      not null default now()
);

create index subscriptions_member_end_idx on public.subscriptions (member_id, end_date desc);
create index subscriptions_gym_end_idx    on public.subscriptions (gym_id,    end_date);

-- ============================================================
-- Table 8: pauses
-- ============================================================

create table public.pauses (
  id               uuid               primary key default gen_random_uuid(),
  gym_id           uuid               not null references public.gyms(id) on delete cascade,
  subscription_id  uuid               not null references public.subscriptions(id),
  start_date       date               not null,
  planned_end_date date,
  resumed_on       date,
  reason           public.pause_reason not null,
  note             text,
  days_added       int,               -- set on resume: resumed_on - start_date
  created_by       uuid               references auth.users(id),
  resumed_by       uuid               references auth.users(id),
  created_at       timestamptz        not null default now()
);

-- Only one open pause per subscription
create unique index pauses_open_uidx
  on public.pauses (subscription_id)
  where resumed_on is null;

-- ============================================================
-- Table 9: extensions
-- ============================================================

create table public.extensions (
  id               uuid                   primary key default gen_random_uuid(),
  gym_id           uuid                   not null references public.gyms(id) on delete cascade,
  subscription_id  uuid                   not null references public.subscriptions(id),
  days_added       int                    not null check (days_added > 0),
  reason           public.extension_reason not null,
  note             text,
  created_by       uuid                   references auth.users(id),
  created_at       timestamptz            not null default now()
);

-- ============================================================
-- Table 10: session_logs
-- ============================================================

create table public.session_logs (
  id               uuid        primary key default gen_random_uuid(),
  gym_id           uuid        not null references public.gyms(id) on delete cascade,
  subscription_id  uuid        not null references public.subscriptions(id),
  member_id        uuid        not null references public.members(id),
  delta            int         not null check (delta in (-1, 1)),  -- -1 deduct, +1 correction
  note             text,
  created_by       uuid        references auth.users(id),
  created_at       timestamptz not null default now()
);

-- ============================================================
-- Table 11: payments (INSERT-only for authenticated; edit/delete via audited RPCs)
-- ============================================================

create table public.payments (
  id                 uuid                   primary key default gen_random_uuid(),
  gym_id             uuid                   not null references public.gyms(id) on delete cascade,
  subscription_id    uuid                   not null references public.subscriptions(id),
  member_id          uuid                   not null references public.members(id),
  amount_dzd         int                    not null check (amount_dzd > 0),
  paid_on            date                   not null default current_date,
  method             public.payment_method  not null default 'cash',
  note               text,
  receipt_no         bigint,                -- per-gym sequence assigned by record_payment
  flagged_duplicate  bool                   not null default false,
  edited_at          timestamptz,
  created_by         uuid                   references auth.users(id),
  created_at         timestamptz            not null default now(),
  updated_at         timestamptz            not null default now()
);

create index payments_gym_paid_on_idx on public.payments (gym_id, paid_on);
create index payments_member_idx      on public.payments (member_id);
create index payments_sub_idx         on public.payments (subscription_id);

-- ============================================================
-- Table 12: reminders (message log)
-- ============================================================

create table public.reminders (
  id               uuid                   primary key default gen_random_uuid(),
  gym_id           uuid                   not null references public.gyms(id) on delete cascade,
  member_id        uuid                   not null references public.members(id),
  subscription_id  uuid                   references public.subscriptions(id),
  kind             public.reminder_kind   not null,
  channel          public.channel         not null,
  language         public.lang            not null,
  body_rendered    text                   not null,
  status           public.reminder_status not null default 'pending',
  scheduled_for    date                   not null,
  sent_at          timestamptz,
  error            text,
  created_by       uuid                   references auth.users(id),   -- null = system/cron
  created_at       timestamptz            not null default now()
);

-- Cron idempotency: no duplicate (subscription, kind, date) for non-manual reminders
create unique index reminders_cron_uidx
  on public.reminders (subscription_id, kind, scheduled_for)
  where kind <> 'manual';

-- ============================================================
-- Table 13: audit_log (INSERT-only for all roles)
-- ============================================================

create table public.audit_log (
  id          bigint      generated always as identity primary key,
  gym_id      uuid        references public.gyms(id),
  actor_id    uuid        references auth.users(id),
  action      text        not null,
  entity_type text        not null,
  entity_id   uuid,
  old_value   jsonb,
  new_value   jsonb,
  reason      text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- Table 14: import_batches
-- ============================================================

create table public.import_batches (
  id               uuid                  primary key default gen_random_uuid(),
  gym_id           uuid                  not null references public.gyms(id) on delete cascade,
  filename         text                  not null,
  storage_path     text,
  status           public.import_status  not null default 'uploaded',
  mapping          jsonb,
  duplicate_policy public.duplicate_policy,
  total_rows       int,
  valid_rows       int,
  error_rows       int,
  duplicate_rows   int,
  imported_count   int,
  skipped_count    int,
  failed_count     int,
  failed_rows_path text,
  created_by       uuid                  references auth.users(id),
  created_at       timestamptz           not null default now()
);

-- ============================================================
-- Table 15: import_rows
-- ============================================================

create table public.import_rows (
  id         uuid                      primary key default gen_random_uuid(),
  batch_id   uuid                      not null references public.import_batches(id) on delete cascade,
  gym_id     uuid                      not null references public.gyms(id) on delete cascade,
  row_no     int                       not null,
  raw        jsonb                     not null,
  normalized jsonb,
  status     public.import_row_status  not null default 'valid',
  reason     text
);

-- ============================================================
-- Table 16: sync_log
-- ============================================================

create table public.sync_log (
  id         uuid        primary key default gen_random_uuid(),
  gym_id     uuid        references public.gyms(id),
  user_id    uuid        references auth.users(id),
  device_id  text,
  outcome    text        not null check (outcome in ('success', 'error')),
  ops_count  int,
  error      text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Table 17: receipt_counters (per-gym sequence for receipt_no)
-- ============================================================

create table public.receipt_counters (
  gym_id  uuid    primary key references public.gyms(id) on delete cascade,
  last_no bigint  not null default 0
);

-- ============================================================
-- updated_at trigger (applied to all mutable tables)
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gyms_updated_at before update on public.gyms
  for each row execute function public.set_updated_at();

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger gym_settings_updated_at before update on public.gym_settings
  for each row execute function public.set_updated_at();

create trigger reminder_templates_updated_at before update on public.reminder_templates
  for each row execute function public.set_updated_at();

create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS helpers
-- ============================================================

create or replace function public.current_gym_id()
returns uuid language sql stable security definer as $$
  select (auth.jwt() -> 'user_metadata' ->> 'gym_id')::uuid;
$$;

create or replace function public.is_admin()
returns bool language sql stable security definer as $$
  select coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin';
$$;

create or replace function public.gym_is_active()
returns bool language sql stable security definer as $$
  select exists (
    select 1 from public.gyms g
    where g.id = public.current_gym_id()
      and g.status = 'active'
  );
$$;

-- ============================================================
-- Enable RLS on all public tables
-- ============================================================

alter table public.gyms                enable row level security;
alter table public.profiles            enable row level security;
alter table public.gym_settings        enable row level security;
alter table public.reminder_templates  enable row level security;
alter table public.members             enable row level security;
alter table public.plans               enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.pauses              enable row level security;
alter table public.extensions          enable row level security;
alter table public.session_logs        enable row level security;
alter table public.payments            enable row level security;
alter table public.reminders           enable row level security;
alter table public.audit_log           enable row level security;
alter table public.import_batches      enable row level security;
alter table public.import_rows         enable row level security;
alter table public.sync_log            enable row level security;
alter table public.receipt_counters    enable row level security;

-- ============================================================
-- RLS policies — gyms
-- ============================================================

-- Admin: read all
create policy "gyms_admin_select" on public.gyms
  for select to authenticated using (public.is_admin());

-- Admin: insert (create new gym)
create policy "gyms_admin_insert" on public.gyms
  for insert to authenticated with check (public.is_admin());

-- Admin: update (suspend/reactivate)
create policy "gyms_admin_update" on public.gyms
  for update to authenticated using (public.is_admin());

-- Owner: read own gym
create policy "gyms_owner_select" on public.gyms
  for select to authenticated
  using (id = public.current_gym_id() and not public.is_admin());

-- ============================================================
-- RLS policies — profiles (self-read/update only; admin reads all)
-- ============================================================

create policy "profiles_self_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid());

create policy "profiles_admin_insert" on public.profiles
  for insert to authenticated
  with check (public.is_admin());

-- ============================================================
-- RLS policies — gym_settings
-- ============================================================

create policy "gym_settings_owner_select" on public.gym_settings
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "gym_settings_owner_update" on public.gym_settings
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "gym_settings_admin_all" on public.gym_settings
  for all to authenticated
  using (public.is_admin());

-- ============================================================
-- RLS policies — reminder_templates
-- ============================================================

create policy "reminder_templates_owner_select" on public.reminder_templates
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "reminder_templates_owner_write" on public.reminder_templates
  for all to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active())
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "reminder_templates_admin_all" on public.reminder_templates
  for all to authenticated
  using (public.is_admin());

-- ============================================================
-- Macro: gym-scoped owner policy (SELECT/INSERT/UPDATE)
-- Applied to: members, plans, subscriptions, pauses, extensions,
--             session_logs, payments, reminders, import_batches,
--             import_rows, sync_log, receipt_counters
-- ============================================================

-- members
create policy "members_owner_select" on public.members
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "members_owner_insert" on public.members
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "members_owner_update" on public.members
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active());

-- plans
create policy "plans_owner_select" on public.plans
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "plans_owner_insert" on public.plans
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "plans_owner_update" on public.plans
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active());

-- subscriptions
create policy "subscriptions_owner_select" on public.subscriptions
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "subscriptions_owner_insert" on public.subscriptions
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "subscriptions_owner_update" on public.subscriptions
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active());

-- pauses
create policy "pauses_owner_select" on public.pauses
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "pauses_owner_insert" on public.pauses
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

create policy "pauses_owner_update" on public.pauses
  for update to authenticated
  using (gym_id = public.current_gym_id() and public.gym_is_active());

-- extensions
create policy "extensions_owner_select" on public.extensions
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "extensions_owner_insert" on public.extensions
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- session_logs
create policy "session_logs_owner_select" on public.session_logs
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "session_logs_owner_insert" on public.session_logs
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- payments (INSERT + SELECT only for authenticated; no UPDATE/DELETE)
create policy "payments_owner_select" on public.payments
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "payments_owner_insert" on public.payments
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- reminders
create policy "reminders_owner_select" on public.reminders
  for select to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()));

create policy "reminders_owner_insert" on public.reminders
  for insert to authenticated
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- audit_log (INSERT-only for all authenticated; admin can read all)
create policy "audit_log_insert" on public.audit_log
  for insert to authenticated
  with check (true);

create policy "audit_log_admin_select" on public.audit_log
  for select to authenticated
  using (public.is_admin() or gym_id = public.current_gym_id());

-- import_batches
create policy "import_batches_owner" on public.import_batches
  for all to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()))
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- import_rows
create policy "import_rows_owner" on public.import_rows
  for all to authenticated
  using (public.is_admin() or (gym_id = public.current_gym_id() and public.gym_is_active()))
  with check (gym_id = public.current_gym_id() and public.gym_is_active());

-- sync_log
create policy "sync_log_owner" on public.sync_log
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- receipt_counters
create policy "receipt_counters_owner" on public.receipt_counters
  for select to authenticated
  using (public.is_admin() or gym_id = public.current_gym_id());

-- ============================================================
-- derive_end_date(plan_type, start_date, duration_months, validity_days)
-- Calendar months for time plans; validity_days for session plans.
-- ============================================================

create or replace function public.derive_end_date(
  p_type           public.plan_type,
  p_start          date,
  p_duration_months int,
  p_validity_days   int
) returns date language plpgsql immutable as $$
begin
  case p_type
    when 'monthly'   then return p_start + (p_duration_months * interval '1 month')::interval;
    when 'quarterly' then return p_start + (p_duration_months * interval '1 month')::interval;
    when 'semiannual' then return p_start + (p_duration_months * interval '1 month')::interval;
    when 'annual'    then return p_start + (p_duration_months * interval '1 month')::interval;
    when 'per_session' then return p_start + (coalesce(p_validity_days, 1) * interval '1 day')::interval;
    when 'class_pack'  then return p_start + (coalesce(p_validity_days, 60) * interval '1 day')::interval;
    else return null;
  end case;
end;
$$;

-- ============================================================
-- View: member_current_subscription
-- Latest non-cancelled subscription per member.
-- ============================================================

create or replace view public.member_current_subscription as
select distinct on (s.member_id)
  s.*
from public.subscriptions s
where s.cancelled_at is null
order by s.member_id, s.end_date desc nulls last, s.created_at desc;

-- ============================================================
-- View: member_status
-- 'frozen' | 'active' | 'expired'
-- Uses gym timezone for "today".
-- ============================================================

create or replace view public.member_status as
select
  m.id                  as member_id,
  m.gym_id,
  mcs.id                as subscription_id,
  mcs.end_date,
  mcs.sessions_remaining,
  mcs.plan_type_snapshot,
  -- open pause on current subscription?
  (exists (
    select 1 from public.pauses p
    where p.subscription_id = mcs.id
      and p.resumed_on is null
  ))                    as is_frozen,
  -- has any subscription at all?
  (mcs.id is not null)  as has_subscription,
  case
    when mcs.id is null then 'expired'
    when exists (
      select 1 from public.pauses p
      where p.subscription_id = mcs.id and p.resumed_on is null
    ) then 'frozen'
    when mcs.end_date >= (now() at time zone coalesce(
      (select g.timezone from public.gyms g where g.id = m.gym_id), 'Africa/Algiers'
    ))::date
      and (mcs.sessions_remaining is null or mcs.sessions_remaining > 0)
    then 'active'
    else 'expired'
  end                   as status
from public.members m
left join public.member_current_subscription mcs on mcs.member_id = m.id
where m.deleted_at is null;

-- ============================================================
-- View: subscription_balance
-- ============================================================

create or replace view public.subscription_balance as
select
  s.id                                          as subscription_id,
  s.gym_id,
  s.member_id,
  s.price_dzd,
  coalesce(sum(p.amount_dzd), 0)::int           as paid,
  (s.price_dzd - coalesce(sum(p.amount_dzd), 0))::int as remaining
from public.subscriptions s
left join public.payments p on p.subscription_id = s.id
group by s.id, s.gym_id, s.member_id, s.price_dzd;

-- Member rollup: total outstanding (remaining > 0)
create or replace view public.member_balance as
select
  sb.member_id,
  sb.gym_id,
  sum(case when sb.remaining > 0 then sb.remaining else 0 end)::int as total_owing
from public.subscription_balance sb
group by sb.member_id, sb.gym_id;

-- ============================================================
-- Function: dashboard_summary(p_gym_id)
-- ============================================================

create or replace function public.dashboard_summary(p_gym_id uuid)
returns jsonb language plpgsql security invoker as $$
declare
  v_tz text;
  v_today date;
  v_active_count bigint;
  v_revenue_today bigint;
  v_revenue_month bigint;
  v_expiring_week bigint;
  v_unpaid_total bigint;
  v_unpaid_member_count bigint;
begin
  select coalesce(timezone, 'Africa/Algiers')
    into v_tz
    from public.gyms where id = p_gym_id;

  v_today := (now() at time zone v_tz)::date;

  -- active members
  select count(*) into v_active_count
  from public.member_status ms
  where ms.gym_id = p_gym_id and ms.status = 'active';

  -- revenue today
  select coalesce(sum(amount_dzd), 0) into v_revenue_today
  from public.payments
  where gym_id = p_gym_id and paid_on = v_today;

  -- revenue this calendar month
  select coalesce(sum(amount_dzd), 0) into v_revenue_month
  from public.payments
  where gym_id = p_gym_id
    and date_trunc('month', paid_on) = date_trunc('month', v_today);

  -- expiring this week (next 7 days)
  select count(*) into v_expiring_week
  from public.member_current_subscription mcs
  join public.members m on m.id = mcs.member_id
  where mcs.gym_id = p_gym_id
    and mcs.end_date between v_today and v_today + 7
    and mcs.cancelled_at is null
    and m.deleted_at is null;

  -- unpaid totals
  select
    coalesce(sum(case when sb.remaining > 0 then sb.remaining else 0 end), 0),
    count(distinct case when sb.remaining > 0 then sb.member_id end)
  into v_unpaid_total, v_unpaid_member_count
  from public.subscription_balance sb
  where sb.gym_id = p_gym_id;

  return jsonb_build_object(
    'active_count',        v_active_count,
    'revenue_today',       v_revenue_today,
    'revenue_month',       v_revenue_month,
    'expiring_week_count', v_expiring_week,
    'unpaid_total',        v_unpaid_total,
    'unpaid_member_count', v_unpaid_member_count,
    'as_of_date',          v_today
  );
end;
$$;

-- ============================================================
-- Function: reminders_due(p_gym_id, p_date)
-- Returns members due for a reminder on p_date.
-- Excludes frozen, already-renewed, reminders disabled.
-- ============================================================

create or replace function public.reminders_due(
  p_gym_id uuid,
  p_date   date
) returns table (
  member_id      uuid,
  subscription_id uuid,
  end_date       date,
  full_name      text,
  phone          text,
  language       public.lang,
  kind           public.reminder_kind
) language plpgsql security invoker as $$
declare
  v_days_before int;
  v_on_expiry   bool;
  v_enabled     bool;
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

  return query
  select
    m.id,
    mcs.id,
    mcs.end_date,
    m.full_name,
    m.phone,
    coalesce(m.language, (select g.default_language from public.gyms g where g.id = p_gym_id)),
    case
      when mcs.end_date = p_date then 'expiry_day'::public.reminder_kind
      else 'before_expiry'::public.reminder_kind
    end
  from public.member_current_subscription mcs
  join public.members m on m.id = mcs.member_id
  where
    mcs.gym_id = p_gym_id
    and m.deleted_at is null
    and mcs.cancelled_at is null
    -- not frozen
    and not exists (
      select 1 from public.pauses p
      where p.subscription_id = mcs.id and p.resumed_on is null
    )
    -- not already renewed (a newer subscription exists)
    and not exists (
      select 1 from public.subscriptions s2
      where s2.member_id = mcs.member_id
        and s2.id <> mcs.id
        and s2.cancelled_at is null
        and s2.created_at > mcs.created_at
    )
    -- within reminder window: before_expiry or expiry_day
    and (
      (mcs.end_date = p_date + v_days_before)
      or (v_on_expiry and mcs.end_date = p_date)
    );
end;
$$;

-- ============================================================
-- RPCs
-- ============================================================

-- ---- create_member ----
create or replace function public.create_member(
  p_id        uuid,
  p_gym_id    uuid,
  p_full_name text,
  p_phone     text,
  p_language  public.lang default null
) returns public.members language plpgsql security invoker as $$
declare
  v_member public.members;
begin
  insert into public.members (id, gym_id, full_name, phone, language, created_by)
  values (p_id, p_gym_id, p_full_name, p_phone, p_language, auth.uid())
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

-- ---- update_member ----
create or replace function public.update_member(
  p_id        uuid,
  p_full_name text,
  p_phone     text,
  p_language  public.lang default null
) returns public.members language plpgsql security invoker as $$
declare
  v_member public.members;
begin
  update public.members
  set full_name = p_full_name,
      phone     = p_phone,
      language  = p_language,
      updated_at = now()
  where id = p_id
    and gym_id = public.current_gym_id()
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

-- ---- upsert_plan ----
create or replace function public.upsert_plan(
  p_id              uuid,
  p_gym_id          uuid,
  p_name            text,
  p_type            public.plan_type,
  p_price_dzd       int,
  p_duration_months int  default null,
  p_session_count   int  default null,
  p_validity_days   int  default null
) returns public.plans language plpgsql security invoker as $$
declare
  v_plan public.plans;
begin
  insert into public.plans (id, gym_id, name, type, price_dzd, duration_months,
                             session_count, validity_days, created_by)
  values (p_id, p_gym_id, p_name, p_type, p_price_dzd, p_duration_months,
          p_session_count, p_validity_days, auth.uid())
  on conflict (id) do update set
    name            = excluded.name,
    type            = excluded.type,
    price_dzd       = excluded.price_dzd,
    duration_months = excluded.duration_months,
    session_count   = excluded.session_count,
    validity_days   = excluded.validity_days,
    updated_at      = now()
  returning * into v_plan;

  -- Audit plan change
  insert into public.audit_log (gym_id, actor_id, action, entity_type, entity_id, new_value)
  values (p_gym_id, auth.uid(), 'upsert_plan', 'plan', v_plan.id,
          to_jsonb(v_plan));

  return v_plan;
end;
$$;

-- ---- set_plan_active ----
create or replace function public.set_plan_active(
  p_id     uuid,
  p_active bool
) returns void language plpgsql security invoker as $$
begin
  update public.plans
  set active = p_active, updated_at = now()
  where id = p_id and gym_id = public.current_gym_id();
end;
$$;

-- ---- assign_subscription ----
create or replace function public.assign_subscription(
  p_id             uuid,
  p_gym_id         uuid,
  p_member_id      uuid,
  p_plan_id        uuid,
  p_start_date     date,
  p_first_payment  jsonb default null  -- {id, amount_dzd, paid_on, method, note}
) returns public.subscriptions language plpgsql security invoker as $$
declare
  v_plan public.plans;
  v_sub  public.subscriptions;
  v_end  date;
begin
  select * into v_plan from public.plans where id = p_plan_id;
  if not found then raise exception 'PLAN_NOT_FOUND'; end if;

  v_end := public.derive_end_date(v_plan.type, p_start_date,
                                   v_plan.duration_months, v_plan.validity_days);

  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, sessions_total, sessions_remaining, created_by
  )
  values (
    p_id, p_gym_id, p_member_id, p_plan_id, v_plan.name, v_plan.type,
    v_plan.price_dzd, p_start_date, v_end,
    v_plan.session_count, v_plan.session_count, auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_sub;

  if v_sub.id is null then
    select * into v_sub from public.subscriptions where id = p_id;
  end if;

  -- optional first payment
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

-- ---- renew_subscription ----
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

-- ---- record_payment ----
create or replace function public.record_payment(
  p_id              uuid,
  p_subscription_id uuid,
  p_amount_dzd      int,
  p_paid_on         date      default current_date,
  p_method          public.payment_method default 'cash',
  p_note            text      default null
) returns public.payments language plpgsql security invoker as $$
declare
  v_gym_id    uuid;
  v_member_id uuid;
  v_receipt   bigint;
  v_payment   public.payments;
begin
  select gym_id, member_id into v_gym_id, v_member_id
  from public.subscriptions where id = p_subscription_id;

  -- Increment per-gym receipt counter
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_id, 1)
  on conflict (gym_id) do update set last_no = receipt_counters.last_no + 1
  returning last_no into v_receipt;

  insert into public.payments (
    id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, note,
    receipt_no, created_by
  )
  values (
    p_id, v_gym_id, p_subscription_id, v_member_id, p_amount_dzd,
    p_paid_on, p_method, p_note, v_receipt, auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_payment;

  if v_payment.id is null then
    select * into v_payment from public.payments where id = p_id;
  end if;

  return v_payment;
end;
$$;

-- ---- edit_payment (reason required, audited) ----
create or replace function public.edit_payment(
  p_id         uuid,
  p_amount_dzd int,
  p_paid_on    date,
  p_method     public.payment_method,
  p_note       text,
  p_reason     text
) returns public.payments language plpgsql security invoker as $$
declare
  v_old  public.payments;
  v_new  public.payments;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using
      hint = 'A reason is required to edit a payment.', errcode = 'P0003';
  end if;

  select * into v_old from public.payments where id = p_id;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  -- Perform update via service-role bypass (authenticated has no UPDATE grant)
  -- NOTE: this RPC runs with SECURITY INVOKER; the policy allows update only
  -- for service-role. For MVP: edit goes through admin Edge Function that uses
  -- service-role key. The function body itself enforces audit.
  update public.payments
  set amount_dzd = p_amount_dzd,
      paid_on    = p_paid_on,
      method     = p_method,
      note       = p_note,
      edited_at  = now(),
      updated_at = now()
  where id = p_id
  returning * into v_new;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id,
    old_value, new_value, reason
  )
  values (
    v_old.gym_id, auth.uid(), 'edit_payment', 'payment', p_id,
    to_jsonb(v_old), to_jsonb(v_new), p_reason
  );

  return v_new;
end;
$$;

-- ---- delete_payment (reason required, audited) ----
create or replace function public.delete_payment(
  p_id     uuid,
  p_reason text
) returns void language plpgsql security invoker as $$
declare
  v_old public.payments;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using
      hint = 'A reason is required to delete a payment.', errcode = 'P0003';
  end if;

  select * into v_old from public.payments where id = p_id;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  delete from public.payments where id = p_id;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id,
    old_value, new_value, reason
  )
  values (
    v_old.gym_id, auth.uid(), 'delete_payment', 'payment', p_id,
    to_jsonb(v_old), null, p_reason
  );
end;
$$;

-- ---- pause_subscription ----
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

-- ---- resume_subscription ----
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

-- ---- extend_subscription ----
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

-- ---- deduct_session ----
create or replace function public.deduct_session(
  p_id              uuid,
  p_gym_id          uuid,
  p_subscription_id uuid,
  p_note            text default null
) returns public.subscriptions language plpgsql security invoker as $$
declare
  v_sub public.subscriptions;
begin
  select * into v_sub from public.subscriptions where id = p_subscription_id;
  if not found then raise exception 'SUBSCRIPTION_NOT_FOUND'; end if;
  if coalesce(v_sub.sessions_remaining, 1) <= 0 then
    raise exception 'NO_SESSIONS_REMAINING';
  end if;

  update public.subscriptions
  set sessions_remaining = sessions_remaining - 1,
      updated_at         = now()
  where id = p_subscription_id
  returning * into v_sub;

  insert into public.session_logs (id, gym_id, subscription_id, member_id, delta, note, created_by)
  values (p_id, p_gym_id, p_subscription_id, v_sub.member_id, -1, p_note, auth.uid());

  return v_sub;
end;
$$;

-- ---- update_gym_settings ----
create or replace function public.update_gym_settings(
  p_gym_id                 uuid,
  p_reminders_enabled      bool,
  p_reminder_days_before   int,
  p_reminder_on_expiry_day bool,
  p_enabled_channels       public.channel[],
  p_onboarding_completed   bool default null
) returns public.gym_settings language plpgsql security invoker as $$
declare
  v_settings public.gym_settings;
begin
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

  return v_settings;
end;
$$;

-- ---- upsert_reminder_template ----
create or replace function public.upsert_reminder_template(
  p_id       uuid,
  p_gym_id   uuid,
  p_language public.lang,
  p_kind     public.reminder_kind,
  p_body     text
) returns public.reminder_templates language plpgsql security invoker as $$
declare
  v_tpl public.reminder_templates;
begin
  insert into public.reminder_templates (id, gym_id, language, kind, body)
  values (p_id, p_gym_id, p_language, p_kind, p_body)
  on conflict (gym_id, language, kind) do update set
    body       = excluded.body,
    updated_at = now()
  returning * into v_tpl;

  return v_tpl;
end;
$$;

-- ---- log_manual_reminder ----
create or replace function public.log_manual_reminder(
  p_id             uuid,
  p_gym_id         uuid,
  p_member_id      uuid,
  p_subscription_id uuid,
  p_channel        public.channel,
  p_language       public.lang,
  p_body_rendered  text,
  p_scheduled_for  date
) returns public.reminders language plpgsql security invoker as $$
declare
  v_r public.reminders;
begin
  insert into public.reminders (
    id, gym_id, member_id, subscription_id, kind, channel, language,
    body_rendered, status, scheduled_for, sent_at, created_by
  )
  values (
    p_id, p_gym_id, p_member_id, p_subscription_id,
    'manual', p_channel, p_language,
    p_body_rendered, 'sent', p_scheduled_for, now(), auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_r;

  if v_r.id is null then
    select * into v_r from public.reminders where id = p_id;
  end if;

  return v_r;
end;
$$;

-- ---- create_import_batch ----
create or replace function public.create_import_batch(
  p_id          uuid,
  p_gym_id      uuid,
  p_filename    text,
  p_storage_path text default null
) returns public.import_batches language plpgsql security invoker as $$
declare
  v_batch public.import_batches;
begin
  insert into public.import_batches (id, gym_id, filename, storage_path, created_by)
  values (p_id, p_gym_id, p_filename, p_storage_path, auth.uid())
  on conflict (id) do nothing
  returning * into v_batch;

  if v_batch.id is null then
    select * into v_batch from public.import_batches where id = p_id;
  end if;

  return v_batch;
end;
$$;

-- ---- save_import_mapping ----
create or replace function public.save_import_mapping(
  p_batch_id uuid,
  p_mapping  jsonb
) returns void language plpgsql security invoker as $$
begin
  update public.import_batches
  set mapping = p_mapping, status = 'mapped'
  where id = p_batch_id and gym_id = public.current_gym_id();
end;
$$;

-- ---- import_validate (simple stub — full implementation in Phase 8) ----
create or replace function public.import_validate(
  p_batch_id uuid
) returns void language plpgsql security invoker as $$
begin
  -- Phase 8 will implement full row-by-row validation.
  -- Stub marks batch as previewed.
  update public.import_batches
  set status = 'previewed'
  where id = p_batch_id and gym_id = public.current_gym_id();
end;
$$;

-- ---- import_commit (stub — full implementation in Phase 8) ----
create or replace function public.import_commit(
  p_batch_id uuid,
  p_policy   public.duplicate_policy
) returns void language plpgsql security invoker as $$
begin
  update public.import_batches
  set status = 'committed', duplicate_policy = p_policy
  where id = p_batch_id and gym_id = public.current_gym_id();
end;
$$;
