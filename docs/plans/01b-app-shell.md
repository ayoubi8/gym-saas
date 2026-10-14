# Phase 1B — App shell, auth, data layer, login, i18n shells

## Goal
Running PWA shell with real login (phone-or-email password auth), the
FRONTEND-BACKEND.md data layer, and AR/FR shells. First screen live.

## Inputs
@AGENTS.md @docs/PRD.md (§5.6, §5.7) @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-MODEL.md ("Auth mapping") @docs/FRONTEND-BACKEND.md
@docs/DATA-CONTRACT.md (01 row) @design/01-login/
@apps/web/src/lib/database.types.ts (from 1A)

## Data contract
- 01 row: sign-in (synthetic-email mapping client-side), post-auth profile+gym read.

## Backend tasks
- None (schema frozen from 1A). If a gap is found, write a NEW migration (never edit
  `0002`) + regenerate types in the same commit.

## Frontend wiring
1. Scaffold per FRONTEND-BACKEND.md §3: `lib/` (supabase client, query-keys factory,
   run-mutation online impl, pg-errors mapper, phone/status/format utils + parity
   tests vs 1A SQL fixtures), `features/auth/` (api/queries/schemas/components),
   `routes.tsx` + guards (admin/owner/suspended), i18n init (`ar`/`fr` shells, switcher,
   `dir` handling, persisted choice).
2. `/login` per `design/01-login/` (code.html layout-only, green tokens, logical
   classes): phone-or-email + password, inline errors via mapper, language switcher.
3. `runMutation(op)` online implementation (direct RPC + invalidate); Dexie NOT yet.

## Tests
- vitest: `normalizeDzPhone` (spaces, +213, Arabic-Indic digits), `getMemberStatus`
  parity vs SQL fixtures, error-mapper coverage (incl. `SUSPENDED_GYM`).
- e2e (Playwright): login with email + with phone; wrong password shows mapped AR/FR
  error; suspended owner blocked; owner cannot open `/admin/*`.

## Done when
Login works against local Supabase for both gyms; guards hold; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 2.
