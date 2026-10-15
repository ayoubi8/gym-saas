// Postgres / Supabase error -> i18n key mapper (FRONTEND-BACKEND.md §5).
// Components render t(mapError(err)) only — never error.message.

export type AppErrorCode =
  | 'DUPLICATE_PHONE'
  | 'INVALID_PHONE'
  | 'MEMBER_NOT_FOUND'
  | 'SUSPENDED_GYM'
  | 'RLS_DENIED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_IDENTIFIER'
  | 'NETWORK_OFFLINE'
  | 'PHONE_TAKEN'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'NOT_FOUND'
  | 'INVALID_INPUT'
  | 'UNKNOWN';

export const ERROR_KEY_BY_CODE: Record<AppErrorCode, string> = {
  DUPLICATE_PHONE: 'members.duplicatePhone',
  INVALID_PHONE: 'members.invalidPhone',
  MEMBER_NOT_FOUND: 'errors.memberNotFound',
  SUSPENDED_GYM: 'errors.gymSuspended',
  RLS_DENIED: 'errors.rlsDenied',
  INVALID_CREDENTIALS: 'auth.invalidLogin',
  INVALID_IDENTIFIER: 'auth.invalidIdentifier',
  NETWORK_OFFLINE: 'errors.offlineQueued',
  PHONE_TAKEN: 'errors.duplicatePhone',
  EMAIL_TAKEN: 'errors.duplicateEmail',
  WEAK_PASSWORD: 'errors.weakPassword',
  NOT_FOUND: 'errors.notFound',
  INVALID_INPUT: 'errors.invalidInput',
  UNKNOWN: 'errors.unknown',
};

// Edge Function bodies return `{ error: <CODE> }` (supabase/functions/_shared/http.ts).
const EDGE_CODE_MAP: Record<string, AppErrorCode> = {
  FORBIDDEN: 'RLS_DENIED',
  INVALID_INPUT: 'INVALID_INPUT',
  PHONE_TAKEN: 'PHONE_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  WEAK_PASSWORD: 'WEAK_PASSWORD',
  NOT_FOUND: 'NOT_FOUND',
  SUSPENDED_GYM: 'SUSPENDED_GYM',
};

/** Map an Edge Function error code string to an AppErrorCode (UNKNOWN fallback). */
export function mapEdgeErrorCode(code: string | undefined | null): AppErrorCode {
  if (!code) return 'UNKNOWN';
  return EDGE_CODE_MAP[code.toUpperCase()] ?? 'UNKNOWN';
}

/** Typed application error carrying an i18n key. */
export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
  }

  get i18nKey(): string {
    return ERROR_KEY_BY_CODE[this.code] ?? ERROR_KEY_BY_CODE.UNKNOWN;
  }
}

interface ErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function detectCode(error: unknown): AppErrorCode {
  if (error instanceof AppError) return error.code;

  const e = (error ?? {}) as ErrorLike;
  const haystack = `${e.message ?? ''} ${e.details ?? ''} ${e.hint ?? ''}`.toUpperCase();

  if (haystack.includes('SUSPENDED_GYM')) return 'SUSPENDED_GYM';
  if (haystack.includes('INVALID_PHONE')) return 'INVALID_PHONE';
  if (
    haystack.includes('DUPLICATE_PHONE') ||
    (e.code === '23505' && (haystack.includes('PHONE') || haystack.includes('MEMBERS_GYM_PHONE')))
  ) {
    return 'DUPLICATE_PHONE';
  }
  if (haystack.includes('MEMBER_NOT_FOUND') || e.code === 'P0002') return 'MEMBER_NOT_FOUND';
  if (
    e.code === '42501' ||
    haystack.includes('RLS_DENIED') ||
    haystack.includes('ROW-LEVEL SECURITY')
  ) {
    return 'RLS_DENIED';
  }
  if (haystack.includes('INVALID_LOGIN_CREDENTIALS') || haystack.includes('INVALID LOGIN CREDENTIALS')) {
    return 'INVALID_CREDENTIALS';
  }
  if (haystack.includes('NETWORK') || e.code === 'NETWORK_OFFLINE') return 'NETWORK_OFFLINE';
  return 'UNKNOWN';
}

/** Normalize any thrown value into an AppError (idempotent). */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = detectCode(error);
  if (code === 'UNKNOWN') {
    console.error('[pg-errors] unmapped error', error);
  }
  let detail: string | undefined;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as ErrorLike).message;
    if (typeof message === 'string') detail = message;
  }
  return new AppError(code, detail);
}

/** Map any thrown value to an i18n key safe to render with t(). */
export function mapError(error: unknown): string {
  return toAppError(error).i18nKey;
}
