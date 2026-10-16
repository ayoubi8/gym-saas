-- ============================================================
-- 0006_phase7_offline.sql — Phase 7 (PWA offline + sync, PRD §5.8)
-- ============================================================
-- The offline affordances already exist in 0002 (client uuids, idempotent RPCs
-- via `on conflict (id) do nothing`, `updated_at`, `payments.flagged_duplicate`,
-- `sync_log`). This migration adds ONLY:
--   1) duplicate-payment detection (two devices recording the same payment)
--   2) the owner review path that clears the flag (audited)
-- No table/column/RLS changes. Function signatures of existing RPCs unchanged.

-- ============================================================
-- flag_duplicate_payments()
-- AFTER INSERT trigger: if a payment with the same subscription + amount +
-- paid_on already exists (different id), flag BOTH rows for owner review.
-- Conflict rule per docs/plans/07-offline.md: payments are append-only, so
-- duplicates are KEPT (never overwritten) and surfaced for review.
-- SECURITY DEFINER: the UPDATE must bypass RLS (authenticated has no UPDATE
-- policy on payments), exactly like the audited edit/delete RPCs in 0004.
-- ============================================================

create or replace function public.flag_duplicate_payments()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.payments p
    where p.subscription_id = new.subscription_id
      and p.amount_dzd = new.amount_dzd
      and p.paid_on = new.paid_on
      and p.id <> new.id
  ) then
    update public.payments
       set flagged_duplicate = true
     where subscription_id = new.subscription_id
       and amount_dzd = new.amount_dzd
       and paid_on = new.paid_on;
  end if;
  return new;
end $$;

drop trigger if exists payments_flag_duplicates on public.payments;
create trigger payments_flag_duplicates
  after insert on public.payments
  for each row execute function public.flag_duplicate_payments();

-- ============================================================
-- clear_payment_duplicate(p_payment_id)
-- Owner review action: mark a flagged payment as reviewed (not a duplicate).
-- Gym-scoped + audited. Called from the payments list (runMutation seam).
-- ============================================================

create or replace function public.clear_payment_duplicate(p_payment_id uuid)
returns public.payments language plpgsql security definer set search_path = public as $$
declare
  v_row public.payments;
  v_gym uuid;
begin
  select * into v_row from public.payments where id = p_payment_id;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  v_gym := v_row.gym_id;
  if v_gym is distinct from public.current_gym_id() and not public.is_admin() then
    raise exception 'RLS_DENIED' using errcode = '42501';
  end if;

  update public.payments
     set flagged_duplicate = false
   where id = p_payment_id
   returning * into v_row;

  insert into public.audit_log (gym_id, actor_id, action, entity_type, entity_id, old_value, new_value)
  values (
    v_gym, auth.uid(), 'payment.duplicate_reviewed', 'payment', p_payment_id,
    jsonb_build_object('flagged_duplicate', true),
    jsonb_build_object('flagged_duplicate', false)
  );

  return v_row;
end $$;
