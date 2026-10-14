# Phase 2 — Admin: gyms + onboarding (PRD §5.6, §7 flows 1–2)

## Goal
Platform owner runs the business: create/suspend/reactivate gyms, reset owner
passwords — all through service-role Edge Functions. New owners get a setup wizard.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (02, 03 rows) @docs/FRONTEND-BACKEND.md (§7)
@design/02-admin-gyms/ @docs/plans/01b-app-shell.md

> `design/03-first-setup/` has NO Stitch export — build from PRD §7 + DESIGN-SYSTEM.md.

## Data contract
- 02 row (Edge Fns + payloads, invalidations `['admin','gyms']`); 03 row (settings read/update, `['settings']`, `['plans']`).

## Backend tasks
- Edge Functions (service role, JWT + `is_admin()` re-check inside):
  `admin_create_gym_with_owner` (creates auth user with `email_confirm=true` using
  synthetic email for phone identities, profile row, gym_settings row with default
  templates, returns credentials ONCE), `admin_reset_owner_password`,
  `admin_set_gym_status` (suspend keeps all data; login fails via `gym_is_active()`).
- No new tables expected; migration only for gaps.

## Frontend wiring
- `features/admin/`: `/admin/gyms` (cards/table, status chips, create modal per
  `code-create.html`, suspend/reactivate, reset-password) behind admin guard.
- `/onboarding` wizard: language → quick-plan create → import shortcut, progress bar,
  skippable; sets `gym_settings.onboarding_completed`.

## Tests
- SQL: admin functions reject non-admin JWT; suspend → owner policies fail closed;
  reactivate restores; reset changes password, sends no mail.
- e2e: full lifecycle create → login as owner → suspend (login fails, data kept) →
  reactivate → reset password → login; audit rows asserted.

## Done when
AGENTS.md §11 ticks; build/lint/test green; SCREENS.md updated if routes change.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 3.
