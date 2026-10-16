// reminders-sender — cron Edge Function (Phase 9, docs/plans/09-reminders.md).
//
// Runs on a schedule (pg_cron / Supabase scheduled function) with the SERVICE
// ROLE key. For every active gym with reminders enabled it materialises the
// due set into `pending` reminder rows, idempotently, then hands each row to
// `sendReminder()`. No public self-invocation.
//
// Auth: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (or x-cron-secret).
// All the business rules live in SQL (`insert_cron_reminders` / `reminders_due`)
// so the cron path and the SQL tests share one source of truth.
//
// Decision D: a real gateway is out of MVP scope, so `sendReminder()` is a
// no-op and rows stay `pending` ("to send"). `sent`/`delivered`/`failed` are
// reserved for a future gateway.

import { adminClient } from '../_shared/clients.ts';
import { EdgeError, errorResponse, json, preflight } from '../_shared/http.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('REMINDERS_CRON_SECRET') ?? '';

type Channel = 'whatsapp' | 'sms' | 'viber';

interface GymRow {
  id: string;
  timezone: string | null;
}

interface PendingReminder {
  id: string;
  gym_id: string;
  member_id: string;
  channel: Channel;
  language: 'ar' | 'fr';
  body_rendered: string;
}

/** ISO date (YYYY-MM-DD) for "now" in the gym's timezone. */
function todayInTimeZone(timeZone: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timeZone || 'Africa/Algiers',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function assertCron(req: Request): void {
  const authorization = req.headers.get('Authorization') ?? req.headers.get('authorization') ?? '';
  const bearer = authorization.replace(/^Bearer\s+/i, '');
  const secret = req.headers.get('x-cron-secret') ?? '';
  const authorized =
    (SERVICE_ROLE_KEY !== '' && bearer === SERVICE_ROLE_KEY) ||
    (CRON_SECRET !== '' && secret === CRON_SECRET);
  if (!authorized) {
    throw new EdgeError('FORBIDDEN', 401, 'cron secret required');
  }
}

/**
 * Gateway seam. A real sender (WhatsApp Business / SMS / Viber) plugs in here
 * and would move a row pending -> sent -> delivered/failed + set `sent_at`.
 * Until then it is a deliberate no-op: rows remain `pending` (decision D).
 */
async function sendReminder(_admin: SupabaseClient, _reminder: PendingReminder): Promise<'skipped'> {
  // TODO(post-MVP): call the messaging provider, then update reminders.status.
  return 'skipped';
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'INVALID_INPUT' }, 405);

  try {
    assertCron(req);
    const admin = adminClient();

    const { data: settings, error: settingsError } = await admin
      .from('gym_settings')
      .select('gym_id')
      .eq('reminders_enabled', true);
    if (settingsError) throw new EdgeError('UNKNOWN', 500, settingsError.message);

    const enabledGymIds = new Set((settings ?? []).map((row) => row.gym_id as string));

    const { data: gyms, error: gymsError } = await admin
      .from('gyms')
      .select('id, timezone')
      .eq('status', 'active');
    if (gymsError) throw new EdgeError('UNKNOWN', 500, gymsError.message);

    const targets = ((gyms ?? []) as GymRow[]).filter((gym) => enabledGymIds.has(gym.id));

    let processed = 0;
    let inserted = 0;

    for (const gym of targets) {
      const { data: count, error } = await admin.rpc('insert_cron_reminders', {
        p_gym_id: gym.id,
        p_date: null,
      });
      if (error) throw new EdgeError('UNKNOWN', 500, `insert_cron_reminders failed: ${error.message}`);
      inserted += typeof count === 'number' ? count : 0;
      processed += 1;

      // Hand the (idempotent) due rows to the gateway seam. No-op today.
      const today = todayInTimeZone(gym.timezone);
      const { data: pending, error: pendingError } = await admin
        .from('reminders')
        .select('id, gym_id, member_id, channel, language, body_rendered')
        .eq('gym_id', gym.id)
        .eq('status', 'pending')
        .eq('scheduled_for', today);
      if (pendingError) {
        throw new EdgeError('UNKNOWN', 500, `pending lookup failed: ${pendingError.message}`);
      }
      for (const reminder of (pending ?? []) as PendingReminder[]) {
        await sendReminder(admin, reminder);
      }
    }

    return json({ gyms_processed: processed, reminders_inserted: inserted });
  } catch (error) {
    return errorResponse(error);
  }
});
