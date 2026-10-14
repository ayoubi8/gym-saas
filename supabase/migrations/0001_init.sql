-- 0001_init.sql (STARTER — extend in Phase 1: Auth, roles, tenant isolation)
-- Entities per docs/PRD.md §6. Full tables + RLS land here as phases progress.
-- Tenant rule: every gym-scoped table carries gym_id; RLS restricts to owner's gym.

create extension if not exists "pgcrypto";

-- Platform tenants -----------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  default_language text not null default 'ar' check (default_language in ('ar','fr')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

-- Owner/admin profiles ( wit Supabase Auth user id as PK; gym_id null = admin)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  gym_id uuid references public.gyms (id),
  full_name text not null,
  role text not null check (role in ('admin','owner')),
  language text not null default 'ar' check (language in ('ar','fr'))
);

-- TODO Phase 1: enable RLS + policies (owner sees own gym only; suspended gym blocked)
-- TODO Phase 2: members, plans, subscriptions, pauses, extensions
-- TODO Phase 3: payments (+ append-only rule), receipts
-- TODO Phase 4-8: reminders/message log, import staging, audit log
