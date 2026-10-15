// Admin authorization guard (AGENTS.md §5.1, FRONTEND-BACKEND.md §7).
// Defense in depth: the JWT identifies the caller, then we re-check the role
// against public.profiles with the service role. We deliberately do NOT trust
// `is_admin()` alone: the DB helper reads raw user_metadata, which a user can
// edit via auth.updateUser() and is therefore spoofable.

import { adminClient, userClient } from './clients.ts';
import { EdgeError } from './http.ts';

/** Returns the caller's user id when (and only when) they are a platform admin. */
export async function requireAdminUserId(req: Request): Promise<string> {
  const authorization = req.headers.get('Authorization') ?? req.headers.get('authorization');
  if (!authorization) {
    throw new EdgeError('FORBIDDEN', 401, 'missing bearer token');
  }

  const { data, error } = await userClient(req).auth.getUser();
  if (error || !data.user) {
    throw new EdgeError('FORBIDDEN', 401, 'invalid or expired token');
  }

  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    throw new EdgeError('FORBIDDEN', 403, 'admin role required');
  }

  return data.user.id;
}
