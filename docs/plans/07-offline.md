# Phase 7 — Offline swap: Dexie outbox + sync bar (PRD §5.8)

## Goal
Small by design: schema affordances landed in 1A (UUIDs, idempotent RPCs,
`updated_at`, `flagged_duplicate`, `sync_log`). This phase swaps `runMutation`
internals to a Dexie outbox + replay, adds the sync bar, and proves conflicts.

## Inputs
@AGENTS.md @docs/PRD.md @docs/FRONTEND-BACKEND.md (§6) @docs/DATA-CONTRACT.md
(global offline codes, edit/delete-online-only rows)

## Data contract
No contract changes. Offline-allowed ops: create/update member, record_payment
(create only), assign/renew, pause/resume/extend. `edit/delete_payment` stay
online-only (UI disables offline). Replays reuse client uuids → idempotent.

## Backend tasks
- None schema-side (verify `sync_log` write path from client post-replay).
- Conflict rule (already in schema): LWW by `updated_at` for members/plans;
  payments append-only — duplicates from two devices kept, `flagged_duplicate=true`
  for owner review (detection: same subscription+amount+paid_on within tolerance,
  different ids — implement as RPC helper if missing, else new migration).

## Frontend wiring
- `lib/run-mutation.ts` internals → Dexie outbox (persist op, FIFO replay on
  reconnect, `sync_log` row per flush with ops_count/outcome). Screen code UNCHANGED.
- Sync bar on every screen (Online/Offline/Syncing/Error + retry); cache-first reads
  offline; dashboard/reminders show last-synced + `last updated`; conflict UI for
  flagged payments (review action).

## Tests
- Playwright offline spec: airplane-mode add-member + record-payment → reconnect →
  rows appear once (replay storm test: double-flush = 1 row), dashboard updates.
- Conflict spec: same payment from two devices → both kept + flagged.
- `sync_log` rows asserted (feeds PRD §9 metric).

## Done when
AGENTS.md §11 ticks (§7 items); build/lint/test + e2e offline spec green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 8.
