-- ============================================================
-- 0004_phase4_payments.sql
-- Phase 4 — Payments + receipts.
--
-- Fixes and hardening on top of the landed 1A schema (no table changes):
--   1. record_payment could never succeed for `authenticated`: it is
--      SECURITY INVOKER but inserts/updates public.receipt_counters, which
--      only has a SELECT policy (no INSERT/UPDATE) -> RLS error. Make it
--      SECURITY DEFINER with an explicit gym-ownership authorization check.
--   2. record_payment now validates amount > 0 (INVALID_AMOUNT) and is
--      replay-safe: a repeated client UUID returns the existing row and does
--      NOT bump the receipt counter (DUPLICATE_REPLAY_OK).
--   3. edit_payment / delete_payment are now SECURITY DEFINER (the 1A bodies
--      could not actually update/delete: authenticated has no UPDATE/DELETE
--      policy on payments), each enforcing gym ownership + reason + audit.
-- ============================================================

-- ------------------------------------------------------------
-- record_payment — idempotent, stamps receipt_no per gym
-- ------------------------------------------------------------

create or replace function public.record_payment(
  p_id              uuid,
  p_subscription_id uuid,
  p_amount_dzd      int,
  p_paid_on         date      default current_date,
  p_method          public.payment_method default 'cash',
  p_note            text      default null
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  v_existing  public.payments;
  v_gym_id    uuid;
  v_member_id uuid;
  v_receipt   bigint;
  v_payment   public.payments;
begin
  if p_amount_dzd is null or p_amount_dzd <= 0 then
    raise exception 'INVALID_AMOUNT' using
      hint = 'Payment amount must be a positive integer (DZD).',
      errcode = 'P0001';
  end if;

  -- Idempotent replay: same client UUID returns the stored row unchanged.
  select * into v_existing from public.payments where id = p_id;
  if found then
    return v_existing;   -- DUPLICATE_REPLAY_OK
  end if;
  if not exists (select 1 from public.subscriptions where id = p_subscription_id) then
    raise exception 'SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select s.gym_id, s.member_id into v_gym_id, v_member_id
  from public.subscriptions s where s.id = p_subscription_id;

  -- SECURITY DEFINER bypasses RLS: authorize explicitly.
  if v_gym_id is distinct from public.current_gym_id() then
    raise exception 'RLS_DENIED' using
      hint = 'Subscription does not belong to your gym.', errcode = '42501';
  end if;

  -- Increment per-gym receipt counter
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_id, 1)
  on conflict (gym_id) do update set last_no = receipt_counters.last_no + 1
  returning last_no into v_receipt;

  insert into public.payments (
    id, gym_id, subscription_id, member_id, amount_dzd, paid_on, method, note,
    receipt_no, created_by
  )
  values (
    p_id, v_gym_id, p_subscription_id, v_member_id, p_amount_dzd,
    coalesce(p_paid_on, current_date), coalesce(p_method, 'cash'), p_note,
    v_receipt, auth.uid()
  )
  on conflict (id) do nothing
  returning * into v_payment;

  if v_payment.id is null then
    -- lost a concurrent replay race: return the stored row
    select * into v_payment from public.payments where id = p_id;
  end if;

  return v_payment;
end;
$$;

-- ------------------------------------------------------------
-- edit_payment — reason mandatory, audited (old/new), gym-scoped
-- ------------------------------------------------------------

create or replace function public.edit_payment(
  p_id         uuid,
  p_amount_dzd int,
  p_paid_on    date,
  p_method     public.payment_method,
  p_note       text,
  p_reason     text
) returns public.payments
language plpgsql security definer set search_path = public as $$
declare
  v_old public.payments;
  v_new public.payments;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using
      hint = 'A reason is required to edit a payment.', errcode = 'P0003';
  end if;
  if p_amount_dzd is null or p_amount_dzd <= 0 then
    raise exception 'INVALID_AMOUNT' using
      hint = 'Payment amount must be a positive integer (DZD).',
      errcode = 'P0001';
  end if;

  select * into v_old from public.payments where id = p_id;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_old.gym_id is distinct from public.current_gym_id() then
    raise exception 'RLS_DENIED' using
      hint = 'Payment does not belong to your gym.', errcode = '42501';
  end if;

  update public.payments
  set amount_dzd = p_amount_dzd,
      paid_on    = p_paid_on,
      method     = p_method,
      note       = p_note,
      edited_at  = now(),
      updated_at = now()
  where id = p_id
  returning * into v_new;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id,
    old_value, new_value, reason
  )
  values (
    v_old.gym_id, auth.uid(), 'edit_payment', 'payment', p_id,
    to_jsonb(v_old), to_jsonb(v_new), p_reason
  );

  return v_new;
end;
$$;

-- ------------------------------------------------------------
-- delete_payment — reason mandatory, audited, gym-scoped
-- ------------------------------------------------------------

create or replace function public.delete_payment(
  p_id     uuid,
  p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_old public.payments;
begin
  if p_reason is null or trim(p_reason) = '' then
    raise exception 'REASON_REQUIRED' using
      hint = 'A reason is required to delete a payment.', errcode = 'P0003';
  end if;

  select * into v_old from public.payments where id = p_id;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002'; end if;

  if v_old.gym_id is distinct from public.current_gym_id() then
    raise exception 'RLS_DENIED' using
      hint = 'Payment does not belong to your gym.', errcode = '42501';
  end if;

  delete from public.payments where id = p_id;

  insert into public.audit_log (
    gym_id, actor_id, action, entity_type, entity_id,
    old_value, new_value, reason
  )
  values (
    v_old.gym_id, auth.uid(), 'delete_payment', 'payment', p_id,
    to_jsonb(v_old), null, p_reason
  );
end;
$$;
