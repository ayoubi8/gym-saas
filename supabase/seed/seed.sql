-- seed.sql — Phase 1A seed data
-- 2 gyms, 2 owners, plans, members across all statuses, payments, pauses
-- Exercises every view/function branch.
-- Auth users are created by Supabase Auth separately; we reference their UUIDs here.
-- For local testing, use supabase db reset which runs migrations then this seed.

-- ============================================================
-- Stable UUIDs (predictable for tests; never change in seed)
-- ============================================================

-- Gym A (active)
do $seed$ declare
  v_gym_a_id   uuid := '11111111-1111-1111-1111-111111111111';
  v_gym_b_id   uuid := '22222222-2222-2222-2222-222222222222';

  -- Owner users (would be created in auth.users first in real Supabase)
  -- For seed, we insert directly to avoid auth dependency
  v_owner_a_uid uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_owner_b_uid uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  v_admin_uid   uuid := 'cccccccc-cccc-cccc-cccc-cccccccccccc';

  -- Plans
  v_plan_monthly_a  uuid := '10000001-0000-0000-0000-000000000001';
  v_plan_quarterly_a uuid := '10000001-0000-0000-0000-000000000002';
  v_plan_session_a  uuid := '10000001-0000-0000-0000-000000000003';
  v_plan_monthly_b  uuid := '20000001-0000-0000-0000-000000000001';

  -- Members Gym A
  v_member_active    uuid := '11110001-0000-0000-0000-000000000001'; -- active
  v_member_expiring  uuid := '11110001-0000-0000-0000-000000000002'; -- expires in 3 days
  v_member_expired   uuid := '11110001-0000-0000-0000-000000000003'; -- expired
  v_member_frozen    uuid := '11110001-0000-0000-0000-000000000004'; -- frozen
  v_member_owing     uuid := '11110001-0000-0000-0000-000000000005'; -- active, partial payment
  v_member_nosub     uuid := '11110001-0000-0000-0000-000000000006'; -- no subscription

  -- Members Gym B
  v_member_b1        uuid := '22220001-0000-0000-0000-000000000001';

  -- Subscriptions
  v_sub_active   uuid := '11120001-0000-0000-0000-000000000001';
  v_sub_expiring uuid := '11120001-0000-0000-0000-000000000002';
  v_sub_expired  uuid := '11120001-0000-0000-0000-000000000003';
  v_sub_frozen   uuid := '11120001-0000-0000-0000-000000000004';
  v_sub_owing    uuid := '11120001-0000-0000-0000-000000000005';
  v_sub_b1       uuid := '22120001-0000-0000-0000-000000000001';

begin
  -- ---- Auth users (stub: insert into auth.users for local seed) ----
  -- Note: In production these are created via Supabase Auth API
  -- For local supabase, we seed minimal rows
  insert into auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, created_at, updated_at, aud, role
  ) values
    (v_admin_uid,  '00000000-0000-0000-0000-000000000000',
     'admin@gymdz.app', crypt('Admin1234!', gen_salt('bf')),
     now(), '{"role":"admin"}'::jsonb, now(), now(), 'authenticated', 'authenticated'),
    (v_owner_a_uid, '00000000-0000-0000-0000-000000000000',
     '213555000001@phone.gymdz.app', crypt('Owner1234!', gen_salt('bf')),
     now(), jsonb_build_object('role','owner','gym_id', v_gym_a_id::text),
     now(), now(), 'authenticated', 'authenticated'),
    (v_owner_b_uid, '00000000-0000-0000-0000-000000000000',
     '213555000002@phone.gymdz.app', crypt('Owner1234!', gen_salt('bf')),
     now(), jsonb_build_object('role','owner','gym_id', v_gym_b_id::text),
     now(), now(), 'authenticated', 'authenticated')
  on conflict (id) do nothing;

  -- ---- Gyms ----
  insert into public.gyms (id, name, city, default_language, timezone, status, created_by)
  values
    (v_gym_a_id, 'نادي الفجر', 'Alger', 'ar', 'Africa/Algiers', 'active', v_admin_uid),
    (v_gym_b_id, 'Salle Olympique', 'Oran', 'fr', 'Africa/Algiers', 'active', v_admin_uid)
  on conflict (id) do nothing;

  -- ---- Profiles ----
  insert into public.profiles (id, gym_id, role, full_name, phone, email, language)
  values
    (v_admin_uid,  null,       'admin', 'Admin Platform', null, 'admin@gymdz.app', 'ar'),
    (v_owner_a_uid, v_gym_a_id, 'owner', 'Karim Boudiaf',  '+213555000001', null, 'ar'),
    (v_owner_b_uid, v_gym_b_id, 'owner', 'Leila Mansouri', '+213555000002', null, 'fr')
  on conflict (id) do nothing;

  -- ---- Gym Settings ----
  insert into public.gym_settings (gym_id, reminders_enabled, reminder_days_before,
                                    reminder_on_expiry_day, enabled_channels, onboarding_completed)
  values
    (v_gym_a_id, true, 3, false, '{whatsapp}', true),
    (v_gym_b_id, true, 3, true,  '{whatsapp,sms}', true)
  on conflict (gym_id) do nothing;

  -- ---- Receipt counters ----
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_a_id, 0), (v_gym_b_id, 0)
  on conflict (gym_id) do nothing;

  -- ---- Plans Gym A ----
  insert into public.plans (id, gym_id, name, type, duration_months, price_dzd, active, created_by)
  values
    (v_plan_monthly_a,   v_gym_a_id, 'شهري', 'monthly',   1, 3000, true, v_owner_a_uid),
    (v_plan_quarterly_a, v_gym_a_id, 'ربع سنوي', 'quarterly', 3, 8000, true, v_owner_a_uid)
  on conflict (id) do nothing;

  insert into public.plans (id, gym_id, name, type, session_count, validity_days, price_dzd, active, created_by)
  values
    (v_plan_session_a, v_gym_a_id, 'عشر حصص', 'class_pack', 10, 60, 5000, true, v_owner_a_uid)
  on conflict (id) do nothing;

  -- Plan Gym B
  insert into public.plans (id, gym_id, name, type, duration_months, price_dzd, active, created_by)
  values
    (v_plan_monthly_b, v_gym_b_id, 'Mensuel', 'monthly', 1, 3500, true, v_owner_b_uid)
  on conflict (id) do nothing;

  -- ---- Members Gym A ----
  insert into public.members (id, gym_id, full_name, phone, language, created_by)
  values
    (v_member_active,   v_gym_a_id, 'يوسف بن علي',     '+213555100001', 'ar', v_owner_a_uid),
    (v_member_expiring, v_gym_a_id, 'سعاد كريمي',       '+213555100002', 'ar', v_owner_a_uid),
    (v_member_expired,  v_gym_a_id, 'عمر بلعيد',        '+213555100003', 'ar', v_owner_a_uid),
    (v_member_frozen,   v_gym_a_id, 'نوال مسعودي',      '+213555100004', 'ar', v_owner_a_uid),
    (v_member_owing,    v_gym_a_id, 'حمزة زروق',        '+213555100005', 'ar', v_owner_a_uid),
    (v_member_nosub,    v_gym_a_id, 'فاطمة حمداني',     '+213555100006', 'ar', v_owner_a_uid)
  on conflict (id) do nothing;

  -- Member Gym B
  insert into public.members (id, gym_id, full_name, phone, language, created_by)
  values
    (v_member_b1, v_gym_b_id, 'Ahmed Bensalem', '+213555200001', 'fr', v_owner_b_uid)
  on conflict (id) do nothing;

  -- ---- Subscriptions ----
  -- Active: end_date = today + 20
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_active, v_gym_a_id, v_member_active, v_plan_monthly_a,
    'شهري', 'monthly', 3000, current_date - 10, current_date + 20, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Expiring: end_date = today + 3 (within reminder window)
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_expiring, v_gym_a_id, v_member_expiring, v_plan_monthly_a,
    'شهري', 'monthly', 3000, current_date - 27, current_date + 3, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Expired: end_date = today - 5
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_expired, v_gym_a_id, v_member_expired, v_plan_monthly_a,
    'شهري', 'monthly', 3000, current_date - 35, current_date - 5, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Frozen: active sub + open pause
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_frozen, v_gym_a_id, v_member_frozen, v_plan_monthly_a,
    'شهري', 'monthly', 3000, current_date - 10, current_date + 20, v_owner_a_uid
  ) on conflict (id) do nothing;

  insert into public.pauses (id, gym_id, subscription_id, start_date, reason, created_by)
  values (
    gen_random_uuid(), v_gym_a_id, v_sub_frozen, current_date - 3, 'injury', v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Owing: active sub, partial payment
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_owing, v_gym_a_id, v_member_owing, v_plan_monthly_a,
    'شهري', 'monthly', 3000, current_date - 5, current_date + 25, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Gym B subscription
  insert into public.subscriptions (
    id, gym_id, member_id, plan_id, plan_name_snapshot, plan_type_snapshot,
    price_dzd, start_date, end_date, created_by
  )
  values (
    v_sub_b1, v_gym_b_id, v_member_b1, v_plan_monthly_b,
    'Mensuel', 'monthly', 3500, current_date - 5, current_date + 25, v_owner_b_uid
  ) on conflict (id) do nothing;

  -- ---- Payments ----
  -- Full payment for active member
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_a_id, 1)
  on conflict (gym_id) do update set last_no = receipt_counters.last_no + 1;

  insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on,
                                method, receipt_no, created_by)
  values (
    gen_random_uuid(), v_gym_a_id, v_sub_active, v_member_active,
    3000, current_date - 10, 'cash', 1, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Partial payment for owing member (1500 of 3000)
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_a_id, 2)
  on conflict (gym_id) do update set last_no = receipt_counters.last_no + 1;

  insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on,
                                method, receipt_no, created_by)
  values (
    gen_random_uuid(), v_gym_a_id, v_sub_owing, v_member_owing,
    1500, current_date - 5, 'cash', 2, v_owner_a_uid
  ) on conflict (id) do nothing;

  -- Full payment for Gym B member
  insert into public.receipt_counters (gym_id, last_no) values (v_gym_b_id, 1)
  on conflict (gym_id) do update set last_no = receipt_counters.last_no + 1;

  insert into public.payments (id, gym_id, subscription_id, member_id, amount_dzd, paid_on,
                                method, receipt_no, created_by)
  values (
    gen_random_uuid(), v_gym_b_id, v_sub_b1, v_member_b1,
    3500, current_date - 5, 'cash', 1, v_owner_b_uid
  ) on conflict (id) do nothing;

  -- ---- Reminder templates ----
  insert into public.reminder_templates (id, gym_id, language, kind, body)
  values
    (gen_random_uuid(), v_gym_a_id, 'ar', 'before_expiry',
     'عزيزي {memberName}، اشتراكك في {gymName} سينتهي بتاريخ {endDate}. يرجى التجديد.'),
    (gen_random_uuid(), v_gym_a_id, 'fr', 'before_expiry',
     'Cher {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.'),
    (gen_random_uuid(), v_gym_b_id, 'ar', 'before_expiry',
     'عزيزي {memberName}، اشتراكك في {gymName} سينتهي بتاريخ {endDate}. يرجى التجديد.'),
    (gen_random_uuid(), v_gym_b_id, 'fr', 'before_expiry',
     'Cher {memberName}, votre abonnement à {gymName} expire le {endDate}. Veuillez renouveler.')
  on conflict (gym_id, language, kind) do nothing;

end;
$seed$;
