// Postgres / Supabase error -> i18n key mapper (FRONTEND-BACKEND.md §5).
// Components render t(mapError(err)) only — never error.message.

export type AppErrorCode =
  | 'DUPLICATE_PHONE'
  | 'INVALID_PHONE'
  | 'MEMBER_NOT_FOUND'
  | 'PLAN_NOT_FOUND'
  | 'ALREADY_RENEWED'
  | 'PAUSE_ALREADY_OPEN'
  | 'ALREADY_RESUMED'
  | 'RESUME_BEFORE_START'
  | 'INVALID_DAYS'
  | 'NO_SESSIONS_REMAINING'
  | 'PAYMENT_NOT_FOUND'
  | 'SUBSCRIPTION_NOT_FOUND'
  | 'REASON_REQUIRED'
  | 'INVALID_AMOUNT'
  | 'OFFLINE_EDIT_BLOCKED'
  | 'BAD_FILE'
  | 'UNKNOWN_COLUMNS'
  | 'BATCH_ALREADY_COMMITTED'
  | 'REMINDERS_DISABLED'
  | 'ALREADY_SENT'
  | 'INVALID_TEMPLATE_VARS'
  | 'DAYS_OUT_OF_RANGE'
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
  PLAN_NOT_FOUND: 'plans.notFound',
  ALREADY_RENEWED: 'subscriptions.alreadyRenewed',
  PAUSE_ALREADY_OPEN: 'subscriptions.pauseAlreadyOpen',
  ALREADY_RESUMED: 'subscriptions.alreadyResumed',
  RESUME_BEFORE_START: 'subscriptions.resumeBeforeStart',
  INVALID_DAYS: 'errors.invalidDays',
  NO_SESSIONS_REMAINING: 'subscriptions.noSessions',
  PAYMENT_NOT_FOUND: 'payments.notFound',
  SUBSCRIPTION_NOT_FOUND: 'subscriptions.notFound',
  REASON_REQUIRED: 'payments.reasonRequired',
  INVALID_AMOUNT: 'payments.invalidAmount',
  OFFLINE_EDIT_BLOCKED: 'payments.offlineEditBlocked',
  BAD_FILE: 'import.badFile',
  UNKNOWN_COLUMNS: 'import.unknownColumns',
  BATCH_ALREADY_COMMITTED: 'import.alreadyCommitted',
  REMINDERS_DISABLED: 'reminders.disabled',
  ALREADY_SENT: 'reminders.alreadySent',
  INVALID_TEMPLATE_VARS: 'settings.invalidVars',
  DAYS_OUT_OF_RANGE: 'settings.daysRange',
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
  if (haystack.includes('REMINDERS_DISABLED')) return 'REMINDERS_DISABLED';
  if (haystack.includes('ALREADY_SENT')) return 'ALREADY_SENT';
  if (haystack.includes('INVALID_TEMPLATE')) return 'INVALID_TEMPLATE_VARS';
  if (haystack.includes('DAYS_OUT_OF_RANGE')) return 'DAYS_OUT_OF_RANGE';
  if (haystack.includes('INVALID_PHONE')) return 'INVALID_PHONE';
  if (haystack.includes('ALREADY_RENEWED')) return 'ALREADY_RENEWED';
  if (haystack.includes('PAUSE_ALREADY_OPEN')) return 'PAUSE_ALREADY_OPEN';
  if (haystack.includes('ALREADY_RESUMED')) return 'ALREADY_RESUMED';
  if (haystack.includes('RESUME_BEFORE_START')) return 'RESUME_BEFORE_START';
  if (haystack.includes('INVALID_DAYS')) return 'INVALID_DAYS';
  if (haystack.includes('NO_SESSIONS_REMAINING')) return 'NO_SESSIONS_REMAINING';
  if (haystack.includes('PAYMENT_NOT_FOUND')) return 'PAYMENT_NOT_FOUND';
  if (haystack.includes('SUBSCRIPTION_NOT_FOUND')) return 'SUBSCRIPTION_NOT_FOUND';
  if (haystack.includes('REASON_REQUIRED')) return 'REASON_REQUIRED';
  if (haystack.includes('INVALID_AMOUNT')) return 'INVALID_AMOUNT';
  if (haystack.includes('OFFLINE_EDIT_BLOCKED')) return 'OFFLINE_EDIT_BLOCKED';
  if (haystack.includes('BATCH_ALREADY_COMMITTED')) return 'BATCH_ALREADY_COMMITTED';
  if (haystack.includes('UNKNOWN_COLUMNS')) return 'UNKNOWN_COLUMNS';
  if (haystack.includes('BAD_FILE')) return 'BAD_FILE';
  if (haystack.includes('PLAN_NOT_FOUND')) return 'PLAN_NOT_FOUND';
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
  if (
    e.code === 'NETWORK_OFFLINE' ||
    haystack.includes('NETWORK') ||
    haystack.includes('FAILED TO FETCH') ||
    haystack.includes('LOAD FAILED') ||
    error instanceof TypeError
  ) {
    return 'NETWORK_OFFLINE';
  }
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
