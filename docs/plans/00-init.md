# Phase 0 — Init, remote, first push

## Goal
Turn the scaffold into a tracked repo: initial commit, GitHub remote, first push,
AGENTS.md working-style touch-up, verified local baseline.

## Inputs
@AGENTS.md @README.md @.gitignore @apps/web/package.json

## Build
1. Add remote `origin https://github.com/ayoubi8/gym-saas.git` (repo must exist
   on GitHub, empty; default branch `main`).
2. AGENTS.md: append working-style rule to §9 or §11 — "one milestone at a time;
   write migrations for schema changes; run build/lint/test before saying done;
   don't touch unrelated files."
3. Stage everything except user originals at repo root (`PRD   Gym...md`,
   `stitch_algerian_gym_management_system/`, `*.zip` stay untracked — or move the
   PRD original out of the repo if the owner confirms; default: leave untracked).
4. Initial commit: `chore: scaffold gym-saas repo (docs, designs, app+supabase skeletons)`.
5. Push `main` to origin.
6. Baseline check in `apps/web`: `npm install`, then `npx tsc --noEmit`
   (package.json `build` needs source files first — record outcome in PROGRESS).

## Tests
- `git status` clean; `git ls-remote origin` reachable; pushed commit visible.

## Done when
Remote `main` matches local; `docs/PROGRESS.md` Phase 0 entry written.

## Close-out
Append `docs/PROGRESS.md` entry → commit (`chore: phase 0 close-out`) → push →
stop and report; await order for Phase 1.
