import { describe, it, expect } from 'vitest';
import {
  createGymSchema,
  generateTempPassword,
  resetPasswordSchema,
} from '../features/admin/schemas';

// Zod messages are i18n keys (login-form.tsx renders t(message)).

const BASE = {
  name: 'Club El Mordjane',
  city: 'Alger',
  default_language: 'ar' as const,
  owner_full_name: 'Karim Benslimane',
  owner_phone_or_email: '0550 12 34 56',
  password: 'DZ-Fit#9821',
};

describe('createGymSchema', () => {
  it('accepts an Algerian phone payload', () => {
    expect(createGymSchema.safeParse(BASE).success).toBe(true);
  });

  it('accepts an email payload', () => {
    const result = createGymSchema.safeParse({ ...BASE, owner_phone_or_email: 'Owner@Club.DZ' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty city (optional field)', () => {
    expect(createGymSchema.safeParse({ ...BASE, city: '' }).success).toBe(true);
  });

  it('rejects an invalid contact with the i18n key', () => {
    const result = createGymSchema.safeParse({ ...BASE, owner_phone_or_email: '12' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.owner_phone_or_email?.[0]).toBe('auth.invalidIdentifier');
    }
  });

  it('rejects a short password with the weakPassword key', () => {
    const result = createGymSchema.safeParse({ ...BASE, password: 'short' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toBe('errors.weakPassword');
    }
  });

  it('rejects an empty gym name with the required key', () => {
    const result = createGymSchema.safeParse({ ...BASE, name: '   ' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name?.[0]).toBe('common.required');
    }
  });
});

describe('resetPasswordSchema', () => {
  it('accepts a uuid + valid password', () => {
    const result = resetPasswordSchema.safeParse({
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      new_password: 'NewPass123!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid user_id', () => {
    expect(resetPasswordSchema.safeParse({ user_id: 'nope', new_password: 'NewPass123!' }).success).toBe(false);
  });
});

describe('generateTempPassword', () => {
  it('returns a >=8 char password with the DZ-Fit# prefix', () => {
    const password = generateTempPassword();
    expect(password.startsWith('DZ-Fit#')).toBe(true);
    expect(password.length).toBeGreaterThanOrEqual(8);
  });
});
