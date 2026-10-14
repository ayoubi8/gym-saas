# Phase 0 — Init close-out (mostly done)

## Goal
Close the scaffold: AGENTS.md working-style rule, verified baseline, PROGRESS entry.

## Inputs
@AGENTS.md @README.md @.gitignore @apps/web/package.json

## Data contract
None (no data access in this phase).

## Backend tasks
None. Record chosen Supabase region + plan in `docs/plans/README.md` locked
decisions if already known (see REVIEW-NOTES R3); otherwise leave for Phase 1A.

## Frontend wiring
- `apps/web`: `npm install`, then `npx tsc --noEmit`; record outcome in PROGRESS.
  (Full scaffold arrives in Phase 1B.)

## Tests
- `git status` clean; `git ls-remote origin` reachable.

## Done when
AGENTS.md working-style rule present ("one milestone at a time; migrations for
schema changes; build/lint/test before done; don't touch unrelated files");
baseline recorded; PROGRESS Phase 0 entry written.

## Close-out
`docs/PROGRESS.md` entry → commit → push `main` → stop; await order for Phase 1A.
