# Phase 4 — Payments + receipts (PRD §5.3)

## Goal
Cash-first money tracking with installments, owing flags, receipts, and a
tamper-evident payment log.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/10-payments-list/ @design/11-receipt/ @docs/plans/03-members-plans-subscriptions.md

## DB
- No new tables expected; enforce append-only: payments UPDATE/DELETE allowed only
  via audited path (trigger or policy writing `audit_log` with old/new + actor).

## Build
1. `/payments`: rows (member, amount DZD, method, date), date filter, day/month totals.
2. Record-payment dialog (per `design/11-receipt/code.html`): amount (whole DZD),
   date, method (cash default, bank/ccp optional), note; optimistic UI + rollback.
3. Receipt view (`code-receipt.html`): member, amount, date, remaining balance;
   printable + shareable (print CSS + Web Share API fallback).
4. Installments: total price / total paid / remaining on subscription + profile;
   owing members flagged (red badge tokens).
5. Edits/deletes of payments: never silent — audit row, UI surfaces history.

## Tests
- Totals math (paid + remaining = price); owing flag triggers; method defaults.
- Audit row asserted on payment edit + delete; RLS re-run.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 5.
