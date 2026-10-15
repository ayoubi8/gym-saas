// admin_reset_owner_password — service-role Edge Function (Phase 2).
// Sets a new password for an owner account. Sends NO email (admin shares it out
// of band). Only owner profiles can be targeted.
// Payload: { user_id, new_password }
// Errors:  FORBIDDEN | INVALID_INPUT | WEAK_PASSWORD | NOT_FOUND | UNKNOWN

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

const MIN_PASSWORD_LENGTH = 8;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'INVALID_INPUT' }, 405);

  try {
    const adminUserId = await requireAdminUserId(req);
    const body = await readJson(req);

    const userId = requireString(body.user_id, 'user_id');
    const newPassword = requireString(body.new_password, 'new_password');
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new EdgeError('WEAK_PASSWORD', 400, `password must be >= ${MIN_PASSWORD_LENGTH} chars`);
    }

    const admin = adminClient();
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, role, gym_id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw new EdgeError('UNKNOWN', 500, `profile lookup failed: ${profileError.message}`);
    if (!profile) throw new EdgeError('NOT_FOUND', 404, 'user not found');
    if (profile.role !== 'owner') {
      throw new EdgeError('FORBIDDEN', 403, 'only owner accounts can be reset');
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updateError) throw new EdgeError('UNKNOWN', 500, `password update failed: ${updateError.message}`);

    await admin.from('audit_log').insert({
      gym_id: profile.gym_id,
      actor_id: adminUserId,
      action: 'admin_reset_owner_password',
      entity_type: 'profile',
      entity_id: userId,
    });

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
});
