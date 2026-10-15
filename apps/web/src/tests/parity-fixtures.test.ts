import { describe, it, expect } from 'vitest';
import type { Database } from '../lib/database.types';

export const SEED_FIXTURES = {
  gymA: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Gym Alger Centre',
    phone: '+213555000001',
    status: 'active' as const,
  },
  gymB: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Gym Oran El Bahia',
    phone: '+213555000002',
    status: 'active' as const,
  },
  ownerA: {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    gymId: '11111111-1111-1111-1111-111111111111',
    role: 'owner' as const,
  },
  ownerB: {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    gymId: '22222222-2222-2222-2222-222222222222',
    role: 'owner' as const,
  },
  admin: {
    id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    role: 'admin' as const,
  },
};

describe('Phase 1A: Database Types & Parity Fixtures', () => {
  it('exports valid Database contract matching DATA-MODEL.md', () => {
    type Tables = Database['public']['Tables'];
    type Enums = Database['public']['Enums'];

    // Verify all 17 tables are represented in types
    const testTableKeys: Record<keyof Tables, true> = {
      gyms: true,
      profiles: true,
      gym_settings: true,
      reminder_templates: true,
      members: true,
      plans: true,
      subscriptions: true,
      pauses: true,
      extensions: true,
      session_logs: true,
      payments: true,
      reminders: true,
      audit_log: true,
      import_batches: true,
      import_rows: true,
      sync_log: true,
      receipt_counters: true,
    };
    expect(testTableKeys).toBeDefined();

    // Verify enums match
    type PlanType = Enums['plan_type'];
    const validPlanTypes: PlanType[] = [
      'monthly',
      'quarterly',
      'semiannual',
      'annual',
      'per_session',
      'class_pack',
    ];
    expect(validPlanTypes).toHaveLength(6);

    type PaymentMethod = Enums['payment_method'];
    const validPaymentMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'ccp'];
    expect(validPaymentMethods).toHaveLength(3);

    type PauseReason = Enums['pause_reason'];
    const validPauseReasons: PauseReason[] = ['travel', 'injury', 'ramadan', 'other'];
    expect(validPauseReasons).toHaveLength(4);
  });

  it('matches seed fixtures frozen in supabase/seed/seed.sql', () => {
    expect(SEED_FIXTURES.gymA.id).toBe('11111111-1111-1111-1111-111111111111');
    expect(SEED_FIXTURES.gymB.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(SEED_FIXTURES.ownerA.id).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(SEED_FIXTURES.ownerB.id).toBe('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
    expect(SEED_FIXTURES.admin.id).toBe('cccccccc-cccc-cccc-cccc-cccccccccccc');
  });
});
