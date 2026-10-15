import { describe, it, expect } from 'vitest';
import {
  SYNTHETIC_PHONE_DOMAIN,
  isEmailLike,
  mapIdentifierToEmail,
  phoneToSyntheticEmail,
} from '../features/auth/identifier';

describe('auth identifier -> synthetic email mapping', () => {
  it('maps a normalized phone to <digits>@phone.gymdz.app', () => {
    expect(phoneToSyntheticEmail('0555 12 34 56')).toBe(`213555123456@${SYNTHETIC_PHONE_DOMAIN}`);
    expect(phoneToSyntheticEmail('+213 555 12 34 56')).toBe(
      `213555123456@${SYNTHETIC_PHONE_DOMAIN}`,
    );
    expect(phoneToSyntheticEmail('٠٥٥٥١٢٣٤٥٦')).toBe(`213555123456@${SYNTHETIC_PHONE_DOMAIN}`);
  });

  it('returns null for invalid phones', () => {
    expect(phoneToSyntheticEmail('12345')).toBeNull();
  });

  it('passes valid emails through lowercased', () => {
    expect(mapIdentifierToEmail('Admin@GymDZ.dz')).toBe('admin@gymdz.dz');
    expect(mapIdentifierToEmail('  owner@gymdz.dz  ')).toBe('owner@gymdz.dz');
  });

  it('routes phones and emails through one entry point', () => {
    expect(mapIdentifierToEmail('0550123456')).toBe(`213550123456@${SYNTHETIC_PHONE_DOMAIN}`);
    expect(mapIdentifierToEmail('')).toBeNull();
    expect(mapIdentifierToEmail('not-an-email@')).toBeNull();
  });

  it('isEmailLike only looks for @', () => {
    expect(isEmailLike('a@b.dz')).toBe(true);
    expect(isEmailLike('0555123456')).toBe(false);
  });
});
