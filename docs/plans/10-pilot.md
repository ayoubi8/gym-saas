# Phase 10 — Pilot hardening + launch (PRD §9, §10-phase 9, §11)

## Goal
Prove the MVP with 3–5 real gyms and tag launch. Fix round only — no new scope.

## Inputs
@AGENTS.md @docs/PRD.md @docs/PROGRESS.md (all phase entries)

## DB
- Demo-gym seed (1 gym, plans, ~30 members across statuses, payments, one import
  batch) for pilots; backup/restore note per PRD §8.

## Build
1. Pilot checklist run per gym: setup < 30 min, 20+ members in 7 days (activation),
   reminder → renew-within-7-days tracking, sync success > 99%.
2. Perf: pages < 3s on 3G after first load; search < 1s at 5,000 members.
3. Fix round from pilot feedback; anything outside PRD MVP → post-MVP list in
   PROGRESS (cite PRD §3/§12), never silently built.
4. Tag `v1.0-mvp` and push tag.

## Tests
- Full suite green; RLS isolation re-verified post-changes; pilot metrics recorded
  in PROGRESS entry.

## Done when
AGENTS.md §11 ticks; success metrics (§9) baselined; tag pushed.

## Close-out
Final `docs/PROGRESS.md` entry → commit → push `main` + tag → launch report.
