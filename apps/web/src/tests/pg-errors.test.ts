import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppError, mapError, toAppError } from '../lib/pg-errors';

describe('pg-errors mapper', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('maps an explicit SUSPENDED_GYM code', () => {
    expect(mapError(new AppError('SUSPENDED_GYM'))).toBe('errors.gymSuspended');
    expect(mapError({ message: 'SUSPENDED_GYM' })).toBe('errors.gymSuspended');
  });

  it('maps RPC app errors raised with P0001 (DUPLICATE_PHONE)', () => {
    const rpcError = {
      code: 'P0001',
      message: 'DUPLICATE_PHONE',
      hint: 'A member with this phone number already exists in this gym.',
    };
    expect(mapError(rpcError)).toBe('members.duplicatePhone');
  });

  it('maps raw 23505 unique violation by constraint name', () => {
    expect(
      mapError({
        code: '23505',
        message: 'duplicate key value violates unique constraint "members_gym_phone_active_uidx"',
        details: 'Key (gym_id, phone)=(…) already exists.',
      }),
    ).toBe('members.duplicatePhone');
  });

  it('maps invalid phone and member-not-found codes', () => {
    expect(mapError({ code: 'P0001', message: 'INVALID_PHONE' })).toBe('members.invalidPhone');
    expect(mapError({ code: 'P0002', message: 'MEMBER_NOT_FOUND' })).toBe('errors.memberNotFound');
  });

  it('maps RLS failures (42501 / row-level security) to errors.rlsDenied', () => {
    expect(mapError({ code: '42501', message: 'permission denied for table members' })).toBe(
      'errors.rlsDenied',
    );
    expect(
      mapError({ code: '42501', message: 'new row violates row-level security policy for table "members"' }),
    ).toBe('errors.rlsDenied');
  });

  it('maps auth failures to auth.invalidLogin', () => {
    expect(mapError({ message: 'Invalid login credentials' })).toBe('auth.invalidLogin');
  });

  it('maps offline/network failures', () => {
    expect(mapError({ code: 'NETWORK_OFFLINE', message: 'network request failed' })).toBe(
      'errors.offlineQueued',
    );
  });

  it('falls back to errors.unknown for unrecognized errors', () => {
    expect(mapError(new Error('boom'))).toBe('errors.unknown');
    expect(mapError(undefined)).toBe('errors.unknown');
  });

  it('toAppError is idempotent and preserves explicit codes', () => {
    const original = new AppError('RLS_DENIED');
    expect(toAppError(original)).toBe(original);
    expect(toAppError({ message: 'SUSPENDED_GYM' }).code).toBe('SUSPENDED_GYM');
  });
});
