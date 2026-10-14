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
- Backup/restore note: state EXACTLY what the ACTIVE plan provides (build = Free:
  daily backups, 7-day retention, no PITR; first pilot gym requires Pro upgrade for
  PITR — R3). Upgrade to Pro BEFORE onboarding the first real pilot gym + tested
  restore steps recorded in PROGRESS.
- Legal gate (R3, BLOCKS pilot onboarding): verify Algerian data-protection law
  18-07 transfer rules with a lawyer/ANPDP; record the outcome in PROGRESS. No real
  member data before this is signed off.
- Cleanup (R4): delete local `stitch_algerian_gym_management_system/` + zip from disk
  (already gitignored); keep `design/` as the source.

## Frontend wiring
- Pilot fixes only. Perf: pages < 3s on 3G post-first-load; search < 1s @ 5k members.
- Pilot rule (R5): owners must NOT share their password — if a gym asks for desk-staff
  access, refuse for MVP (cite PRD §11 Q3) and log it post-MVP; never build a
  receptionist role in the pilot.

## Tests
- Full suite green; RLS isolation re-verified; pilot metrics in PROGRESS (activation
  20+ members/7d, setup < 30min, renew-within-7d, sync success > 99% from `sync_log`).

## Done when
AGENTS.md §11 ticks; metrics baselined; tag `v1.0-mvp` pushed.

## Close-out
Final PROGRESS entry → commit → push `main` + tag → launch report.
