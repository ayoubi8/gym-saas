# Phase 3 — Members, plans, subscriptions, freeze/extend (PRD §5.1, §5.2)

## Goal
Core gym loop live: members with derived status, plans, assign/renew, session
packs, freeze/resume/extend — every write a single RPC call from screens.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@docs/DATA-CONTRACT.md (04, 06, 07, 08, 09, 12 rows) @docs/FRONTEND-BACKEND.md
@design/04-plans/ @design/07-member-profile/ @design/08-add-member/
@design/09-renew-subscription/ @design/12-freeze-resume/

> `design/06-members-list/` has NO Stitch export — build from SCREENS.md row 06.

## Data contract
Rows 04/06/07/08/09/12: reads via `member_status`, `member_current_subscription`,
`subscription_balance`; writes ONLY via `create/update_member`, `upsert_plan`,
`set_plan_active`, `assign_subscription`, `renew_subscription`, `pause/resume/extend_subscription`, `deduct_session`; error codes → i18n; invalidations as listed.

## Backend tasks
- Implement (1A skeletons → full bodies): `create_member` (server-side normalization
  + `DUPLICATE_PHONE`), `update_member`, `upsert_plan`/`set_plan_active`,
  `assign_subscription` (snapshot price, `derive_end_date()`), `renew_subscription`
  (day-after/today + `renewed_from_id` + `ALREADY_RENEWED` guard), `deduct_session`
  (+ `session_logs` row), pause/resume/extend (+ audit triggers already in 1A).
- Migration only (no table changes expected unless R1 changes derivation).

## Frontend wiring
- `features/members|plans|subscriptions/`: `/members` (trigram search, status/owing
  chips, cards→table, FAB), `/members/new|edit` (zod, inline errors, mapper),
  `/members/:id` (status chip from single `getMemberStatus`, balance banner, history,
  action dialogs), `/plans` (CRUD + deactivate; snapshot isolation note in UI),
  renew/freeze dialogs (one-action renew; reason selects; resume preview +days).
- All writes via `runMutation` → invalidation keys per contract.

## Tests
- SQL: renew-start rule, resume extends exactly by paused days, one-open-pause,
  snapshot isolation, deduct floor at 0 + log row.
- vitest: status matrix incl. pause boundaries, phone/normalize parity.
- e2e: add → assign → renew → freeze → resume → extend happy path; duplicate phone
  shows mapped message; RLS re-run with 2 gyms.

## Done when
AGENTS.md §11 ticks; build/lint/test green.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 4.
