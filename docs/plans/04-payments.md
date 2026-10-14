# Phase 4 — Payments + receipts (PRD §5.3)

## Goal
Cash-first money tracking with installments, owing flags, receipts, and a
tamper-evident log. THE payments rule (enforced here, everywhere): INSERT-only for
`authenticated`; edits/deletes ONLY via audited RPC with reason; offline may ONLY
create (Phase 7 disables edit/delete offline).

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (10, 11 rows) @design/10-payments-list/ @design/11-receipt/

## Data contract
Rows 10/11: `record_payment` (idempotent client uuid → `DUPLICATE_REPLAY_OK`),
`edit/delete_payment` (reason required, online-only), `receipt_no` from
`receipt_counters`; reads via `payments` indexes + `subscription_balance`.

## Backend tasks
- Implement: `record_payment` (validates amount > 0, stamps `receipt_no`
  in-transaction), `edit_payment`/`delete_payment` (reason mandatory → `audit_log`
  old/new; RLS already denies direct UPDATE/DELETE from 1A — verify, don't re-add).
- `receipt_no` definition: per-gym sequence via `receipt_counters`, assigned
  server-side at insert AND at sync replay (offline-created rows get numbers then).

## Frontend wiring
- `features/payments/`: `/payments` (date filter, day/month totals, row actions with
  reason dialog), record dialog (integer DZD input, cash default, optimistic +
  rollback), receipt view (print CSS + Web Share fallback; shows remaining/credit),
  owing badges from `member_balance`.
- Edit/delete buttons hidden/disabled when offline (`payments.offlineEditBlocked`).

## Tests
- SQL: direct UPDATE/DELETE as authenticated fails; RPC without reason fails; audit
  old/new asserted; replay same id = 1 row; `receipt_no` strictly increasing per gym.
- vitest: totals math, owing flag, mapper codes.
- e2e: record → receipt → edit (reason) → audit visible; RLS re-run.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 5.
