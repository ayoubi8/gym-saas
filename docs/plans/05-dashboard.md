# Phase 5 — Dashboard (PRD §5.5)

## Goal
One screen, readable in seconds on a phone: members, revenue, expiries, debts —
each tappable into its filtered list.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/05-dashboard/

## DB
- Read-only aggregations; revenue = SUM(`payments` in period), never subscription
  prices. Prefer one RPC/view for the 4 widgets (consistent numbers).

## Build
1. `/` dashboard: 4 tappable widgets (Active members; Revenue today+month DZD;
   Expiring this week; Unpaid total + count) → each deep-links its filtered list.
2. Expiring + owing preview lists with one-tap actions (remind / open profile).
3. Numbers refresh after every mutation (TanStack Query invalidation incl. sync).
4. Offline: last-synced data + visible `last_synced_at` (wires fully in Phase 7;
   label ships now).

## Tests
- Revenue counts payments in window (subscription prices excluded); widget counts
  match list queries; deep-links land on correctly filtered lists.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 6.
