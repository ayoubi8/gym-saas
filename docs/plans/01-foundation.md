# Phase 1 — Foundation (PRD §4, §5.6, §6)

## Goal
Working app shell, full DB schema with tenant isolation at the data layer,
Admin/Owner auth, seed data, and a test proving gym A cannot read gym B.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/01-login/ @supabase/migrations/0001_init.sql
@apps/web/package.json @apps/web/.env.example @supabase/README.md

## DB (new migration `0002_core_schema.sql`)
- All PRD §6 entities: `members` (soft-delete `deleted_at`), `plans`, `subscriptions`
  (price copied from plan), `pauses`, `extensions`, `payments` (integer DZD),
  `reminders`/message log, `audit_log`.
- `gym_id` on every gym-scoped table; partial unique index on normalized phone per
  gym (`deleted_at IS NULL`); CHECK constraints (amounts `>= 0`, enums).
- RLS: owner sees own gym only; admin bypass; suspended gym blocked at login
  (profile/gym status check). Helper `auth.gym_id()` + single status SQL view
  (`active` / `expired` / `frozen` per AGENTS.md §5.2).

## Build
1. Vite + React + TS + Tailwind + Router + i18next (ar/fr shells) + TanStack Query
   + Supabase client isolated in `apps/web/src/lib/supabase.ts`.
2. Login page at `/login` per `design/01-login/` (code.html = layout only, green
   tokens, logical classes, language switcher). Auth: phone-or-email + password;
   password reset is admin-side only (MVP).
3. Seed script: 2 gyms + 1 owner each + plans + members with subscriptions/payments.

## Tests
- vitest: `normalizeDzPhone` (spaces, +213, Arabic-Indic digits), `getMemberStatus`
  (active/expired/frozen), `calcEndDate` per plan type, renew-start rule.
- Isolation test: session scoped to gym A gets zero rows from gym B on every
  gym-scoped table (client-level + RLS-level). This test is the phase gate.

## Done when
AGENTS.md §11 ticks for this scope; `npm run build`, `lint`, `test` green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 2.
