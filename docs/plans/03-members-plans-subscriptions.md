# Phase 3 — Members, plans, subscriptions, freeze/extend (PRD §5.1, §5.2)

## Goal
Core gym loop: members with derived status, plans, assign/renew, session packs,
freeze/resume/extend — all audited.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/04-plans/ @design/07-member-profile/ @design/08-add-member/
@design/09-renew-subscription/ @design/12-freeze-resume/

> `design/06-members-list/` has NO Stitch export — build `/members` from the
> SCREENS.md row 06 spec (search, status chips, member cards, FAB).

## DB
- Migration only for gaps (e.g. sessions-remaining handling). Reuse Phase 1 view.
- Every freeze/resume/extension + plan change writes `audit_log` (who/when/reason).

## Build
1. `/members`: instant search (name/phone), filters Active/Expired/Frozen/Owing,
   cards on mobile → table on desktop, FAB add (≤3 taps from home).
2. `/members/new`, `/members/:id/edit`: zod forms, inline AR/FR errors, phone
   normalization before save/compare, duplicate → clear message.
3. `/members/:id`: status chip (single `getMemberStatus`), plan + end date, balance
   banner, payment history, actions (renew / freeze / pay).
4. `/plans`: CRUD + deactivate; price change never touches existing subscriptions.
5. Renew dialog: one action, starts day-after `end_date` (or today if expired).
6. Session/per-visit packs: remaining-sessions counter + manual deduct.
7. Freeze dialog: reason (travel/injury/ramadan/other); resume extends `end_date`
   by paused days; extend-by-days with reason.

## Tests
- Status matrix (active/expired/frozen incl. pause boundaries); renew-start rule;
  resume extends `end_date` exactly by paused days; plan price change isolation.
- RLS re-run with 2 gyms on new queries.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 4.
