// admin_set_gym_status — service-role Edge Function (Phase 2).
// Suspend or reactivate a gym. Suspension keeps all data; owner login fails via
// public.gym_is_active() so the whole RLS surface fails closed.
// Payload: { gym_id, status: 'active' | 'suspended' }
// Errors:  FORBIDDEN | INVALID_INPUT | NOT_FOUND | UNKNOWN

import { adminClient } from '../_shared/clients.ts';
import { requireAdminUserId } from '../_shared/admin-guard.ts';
import {
  EdgeError,
  errorResponse,
  json,
  preflight,
  readJson,
  requireString,
} from '../_shared/http.ts';

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'INVALID_INPUT' }, 405);

  try {
    const adminUserId = await requireAdminUserId(req);
    const body = await readJson(req);

    const gymId = requireString(body.gym_id, 'gym_id');
    const status = requireString(body.status, 'status');
    if (status !== 'active' && status !== 'suspended') {
      throw new EdgeError('INVALID_INPUT', 400, "status must be 'active' or 'suspended'");
    }

    const admin = adminClient();
    const { data: gym, error } = await admin
      .from('gyms')
      .update({
        status,
        suspended_at: status === 'suspended' ? new Date().toISOString() : null,
      })
      .eq('id', gymId)
      .select()
      .maybeSingle();

    if (error) throw new EdgeError('UNKNOWN', 500, `gym update failed: ${error.message}`);
    if (!gym) throw new EdgeError('NOT_FOUND', 404, 'gym not found');

    await admin.from('audit_log').insert({
      gym_id: gym.id,
      actor_id: adminUserId,
      action: status === 'suspended' ? 'admin_suspend_gym' : 'admin_reactivate_gym',
      entity_type: 'gym',
      entity_id: gym.id,
      new_value: { status, suspended_at: gym.suspended_at },
    });

    return json({ gym });
  } catch (error) {
    return errorResponse(error);
  }
});
