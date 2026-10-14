# Phase 9 — Reminders: due-set, cron, manual send (PRD §5.4)

## Goal
System decides WHO is due (gym-tz, idempotent), logs everything, owner sends with
one tap (`wa.me`/SMS/Viber deep links). Gateway stays behind `sendReminder()`.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (13, 15 rows) @design/13-reminders-expiring/
@supabase/functions/reminders-sender/

> `design/15-settings/` has NO Stitch export — build from FR-A2/A7.

## Data contract
Rows 13/15: `reminders_due()` reads; `log_manual_reminder` writes (kind=`manual`);
settings/templates writes; `ALREADY_SENT` from the idempotency UNIQUE index.

## Backend tasks
- Implement `reminders_due()`: gym-timezone "today", `days_before` window OR
  expiry-day (toggle), exclusions (frozen, renewed via newer subscription,
  `reminders_enabled=false`); UNIQUE `(subscription_id, kind, scheduled_for)`
  prevents duplicate cron rows.
- Edge Function `reminders-sender` (cron, service role): iterates gyms with
  `reminders_enabled`, calls `reminders_due()`, inserts `pending` rows
  (`ON CONFLICT DO NOTHING`), then `sendReminder()` seam = log-only today
  (marks rows, records `body_rendered`); manual deep-link send is client-side.
- UI wording (R6): cron `pending` rows show "to send"; owner taps log
  kind='manual' rows shown as "Opened in WhatsApp" — the word "sent" MUST NOT
  appear for manual sends; `delivered`/`failed` reserved for the gateway.
- Seed default AR+FR templates per gym at creation (Phase 2 function must insert them).

## Frontend wiring
- `features/reminders|settings/`: `/reminders` (due list + one-tap deep-link send
  with prefilled rendered body + per-member log), `/settings` (days 1–30, toggles,
  global on/off, AR/FR template editors with variable validation).

## Tests
- SQL: frozen/renewed excluded; boundary (exactly N days); expiry-day toggle;
  global off = empty set; double-cron = no duplicate rows.
- vitest/e2e: template renders both languages; every attempt logged; manual send
  opens correct deep link.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 10.
