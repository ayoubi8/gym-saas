# Phase 1A — Database: full schema, RLS, RPCs, seed, isolation proof

## Goal
The entire DATA-MODEL.md implemented in Postgres: enums, 17 tables, triggers,
views, `derive_end_date()`, `dashboard_summary()`, `reminders_due()`, all RPCs,
RLS everywhere, seed data, generated types, and a test suite proving tenant
isolation. No UI.

## Inputs
@AGENTS.md @docs/PRD.md (§4, §5.6, §6) @docs/DATA-MODEL.md (authoritative)
@docs/TRACEABILITY.md (FR-R4/R5, FR-M6 rows) @docs/plans/REVIEW-NOTES.md (R1, R3, R7)

## Data contract
No screens yet. This phase delivers every table/view/RPC the DATA-CONTRACT.md
rows reference. RPC error codes (`DUPLICATE_PHONE`, `REASON_REQUIRED`, …) are
defined here via `RAISE ... HINT`.

## Backend tasks
Migration `0002_core_schema.sql` (extends `0001_init.sql` untouched):
1. Enums (all DATA-MODEL.md enums incl. `import_row_status`); `pg_trgm` extension.
2. Tables 1–17: gyms, profiles (+ CHECKs), gym_settings, reminder_templates,
   members (+ partial UNIQUE, trigram + btree indexes), plans (+ per-type CHECKs),
   subscriptions (+ snapshots, `renewed_from_id`, `cancelled_at`), pauses (+ one-open
   partial UNIQUE), extensions, session_logs, payments (+ `receipt_no`), reminders
   (+ cron-idempotency UNIQUE), audit_log (identity PK), import_batches, import_rows,
   sync_log, receipt_counters.
3. `updated_at` trigger on all mutable tables (LWW basis); client-supplied UUID PKs
   with `ON CONFLICT (id) DO NOTHING` idempotency convention in RPCs.
4. Views/functions: `member_current_subscription`, `member_status` (gym-tz "today"),
   `subscription_balance` + member rollup, `dashboard_summary()`, `reminders_due()`,
   `derive_end_date()`, RLS helpers `current_gym_id()`, `is_admin()`, `gym_is_active()`.
5. RLS: owner policies (`gym_id = current_gym_id() AND gym_is_active()`) on every gym
   table; profiles self-read; gym_settings/templates own-gym; admin bypass; suspended
   gym fails closed (data kept); `authenticated`: NO UPDATE/DELETE on `payments` and
   `audit_log` (INSERT-only); Storage `imports/{gym_id}/…` path-scoped policies.
6. RPCs (SECURITY INVOKER, gym re-checked): `create_member`, `update_member`,
   `upsert_plan`, `set_plan_active`, `assign_subscription` (+optional first_payment),
   `renew_subscription`, `record_payment` (stamps `receipt_no`), `edit_payment` /
   `delete_payment` (reason required), `pause/resume/extend_subscription`,
   `deduct_session`, `import_validate` / `import_commit` (chunked, idempotent),
   `update_gym_settings`, `upsert_reminder_template`, `log_manual_reminder`,
   `save_import_mapping`, `create_import_batch`.
7. Audit triggers: freeze/resume/extend, plan changes, payment edits/deletes write
   `audit_log` with actor + old/new + reason.
8. Seed (`supabase/seed/seed.sql`): 2 gyms + owners + plans + members across statuses
   + payments + pauses (exercises every view branch).
9. Types: `supabase gen types` → `apps/web/src/lib/database.types.ts` (same commit).

## Frontend wiring
None (types file only — no components, no hooks).

## Tests
- `supabase/tests/*.sql` assertion scripts (plain-SQL DO blocks, REVIEW-NOTES R7):
  per-table gym-A-can't-read-gym-B (SELECT/INSERT/UPDATE attempted cross-gym = 0 rows);
  suspended gym fails closed; payments UPDATE/DELETE denied; audit rows appear for
  pause/extend/plan-change; `reminders_due()` exclusions; idempotent replay (same id twice = 1 row).
- vitest parity fixtures prepared (TS mirrors land in 1B; SQL expected-values frozen here).

## Done when
All SQL tests green local (`supabase db reset` + test run); types generated;
AGENTS.md §11 data-layer ticks; R1 (months vs days) + R3 (region/plan) recorded or decided.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 1B.
