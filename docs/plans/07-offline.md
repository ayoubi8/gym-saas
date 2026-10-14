# Phase 7 — PWA offline + sync (PRD §5.8)

## Goal
Usable on bad connections: core actions work offline, queue, and sync cleanly on
reconnect with an honest status bar.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md
@apps/web/package.json (vite-plugin-pwa) @docs/plans/03-members-plans-subscriptions.md
@docs/plans/04-payments.md

## DB
- Conflict-safe shape: `updated_at` on mutable tables (last-write-wins);
  payments stay append-only (server keeps both, UI flags duplicates for review).

## Build
1. `vite-plugin-pwa` (Workbox): installable, cached shell, small first payload,
   fast repeat loads on 3G.
2. Dexie IndexedDB outbox: offline queue for view/add/edit member, record payment,
   assign/renew, freeze/resume; auto-sync on reconnect; cache-first reads offline.
3. Sync bar on every screen: Online / Offline / Syncing / Sync error (+ retry).
4. Dashboard/reminders offline: last-synced data + `last updated` timestamp (finish
   the Phase 5 label wiring).
5. Optimistic UI with rollback on sync failure (forms already optimistic).

## Tests
- Offline script (Playwright): airplane-mode record payment → reconnect → server
  row appears, dashboard updates; conflict case keeps both payments + flag.
- Sync success-rate path instrumented (PRD §9 metric).

## Done when
AGENTS.md §11 ticks (§7 items); build/lint/test (+e2e offline spec) green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 8.
