# Phase 5 — Dashboard (PRD §5.5)

## Goal
One screen, readable in seconds: members, revenue, expiries, debts — each tappable.
Dashboard reads `dashboard_summary()` ONLY (single call, consistent numbers).

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (05 row) @design/05-dashboard/

## Data contract
Row 05: `dashboard_summary()` + 5-row previews (`reminders_due()`, owing query).
No writes. Widget invalidation map owned by Phases 3/4 invalidations.

## Backend tasks
- Implement `dashboard_summary()` body (1A skeleton): revenue = SUM `payments.paid_on`
  in gym tz (today/month), never prices; expiring-week window; unpaid rollup.
- No new tables/RPCs.

## Frontend wiring
- `features/dashboard/`: `/` 4 tappable widgets → deep-links (members filtered,
  payments date-filtered, reminders, owing list); expiring + owing previews with
  one-tap actions; `last_synced_at` label (static "just now" online; real wiring Ph7).

## Tests
- SQL: revenue excludes subscription prices; window boundaries in gym tz; counts
  match underlying list queries on seed fixtures.
- vitest/e2e: widget numbers update after record-payment/renew mutations; deep-links
  land on correctly filtered lists.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 6.
