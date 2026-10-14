# Phase 2 — Admin: gyms + onboarding (PRD §5.6, §7 flows 1–2)

## Goal
Platform owner can run the business: manage gyms and onboard owners. Owner gets a
first-setup wizard.

## Inputs
@AGENTS.md @docs/PRD.md @docs/DESIGN-SYSTEM.md @docs/SCREENS.md
@design/02-admin-gyms/ @design/01-login/ @docs/plans/01-foundation.md

> `design/03-first-setup/` has NO Stitch export — build the wizard from PRD §7
> flows 1–2 + DESIGN-SYSTEM.md, and note the gap in PROGRESS.

## DB
- Migration only if gaps found (e.g. gym credentials hand-off fields). RLS: admin
  full access to `gyms`/`profiles`; owners denied.

## Build
1. `/admin/gyms`: gym cards/table (status chips active/suspended), create-gym modal
   (per `design/02-admin-gyms/code-create.html`), suspend/reactivate, owner password
   reset. Admin-only route guard.
2. `/onboarding` wizard (owner, first login): language pick → create plans shortcut
   → import shortcut, progress bar, skippable.
3. Duplicate-phone error path shows clear AR/FR message (foundation util reuse).

## Tests
- Route guards: owner hitting `/admin/*` is refused; suspended owner's login fails
  with data retained.
- Admin create → suspend → reactivate cycle; audit row written.

## Done when
AGENTS.md §11 ticks; build/lint/test green; SCREENS.md updated if routes change.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 3.
