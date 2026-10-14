# Phase 10 — Pilot hardening + launch (PRD §9, §10-phase 9, §11)

## Goal
Prove the MVP with 3–5 real gyms and tag launch. Fix round only — no new scope;
out-of-scope requests go to a post-MVP list (cite PRD §3/§12).

## Inputs
@AGENTS.md @docs/PRD.md @docs/PROGRESS.md (all entries) @docs/REVIEW-NOTES.md (R3–R5)

## Data contract
No changes (read-only verification of existing contracts).

## Backend tasks
- Demo-gym seed (1 gym, plans, ~30 members across statuses, payments, 1 import batch).
- Backup/restore note: state EXACTLY what the chosen Supabase plan provides (Free =
  daily backups, 7-day retention, no PITR; Pro adds PITR) + tested restore steps.
  If plan/region still open (R3), decide here and record in README locked decisions.
- Optional cleanup: remove raw `stitch_algerian_gym_management_system/` + zip (R4).

## Frontend wiring
- Pilot fixes only. Perf: pages < 3s on 3G post-first-load; search < 1s @ 5k members.

## Tests
- Full suite green; RLS isolation re-verified; pilot metrics in PROGRESS (activation
  20+ members/7d, setup < 30min, renew-within-7d, sync success > 99% from `sync_log`).

## Done when
AGENTS.md §11 ticks; metrics baselined; tag `v1.0-mvp` pushed.

## Close-out
Final PROGRESS entry → commit → push `main` + tag → launch report.
