// Shared HTTP helpers for gym-saas Edge Functions.
// Every function returns JSON with CORS headers and a stable `{ error: <CODE> }`
// body so the web client can map codes -> i18n keys (lib/pg-errors.ts).

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Error codes understood by the web client (mirrors lib/pg-errors.ts). */
export type EdgeErrorCode =
  | 'FORBIDDEN'
  | 'INVALID_INPUT'
  | 'PHONE_TAKEN'
  | 'EMAIL_TAKEN'
  | 'WEAK_PASSWORD'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export class EdgeError extends Error {
  readonly code: EdgeErrorCode;
  readonly status: number;

  constructor(code: EdgeErrorCode, status = 400, message?: string) {
    super(message ?? code);
    this.name = 'EdgeError';
    this.code = code;
    this.status = status;
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof EdgeError) {
    return json({ error: error.code }, error.status);
  }
  console.error('[edge] unhandled error', error);
  return json({ error: 'UNKNOWN' }, 500);
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body && typeof body === 'object') return body as Record<string, unknown>;
    throw new Error('not an object');
  } catch {
    throw new EdgeError('INVALID_INPUT', 400, 'expected a JSON object body');
  }
}

/** Trim + require a non-empty string. */
export function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new EdgeError('INVALID_INPUT', 400, `missing field: ${field}`);
  }
  return value.trim();
}
