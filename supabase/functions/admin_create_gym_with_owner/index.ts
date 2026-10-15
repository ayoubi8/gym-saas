// admin_create_gym_with_owner — service-role Edge Function (Phase 2, PRD §7 flow 1).
// Creates a gym + owner auth user (email_confirm=true) + profile + gym_settings
// + default reminder templates in one call, and returns the login ONCE.
// Payload: { name, city?, default_language, owner_full_name, owner_phone_or_email, password }
// Errors:  FORBIDDEN | INVALID_INPUT | PHONE_TAKEN | EMAIL_TAKEN | WEAK_PASSWORD | UNKNOWN

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
import { normalizeDzPhone, phoneToSyntheticEmail } from '../_shared/phone.ts';
import { DEFAULT_REMINDER_TEMPLATES } from '../_shared/reminder-templates.ts';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight();
  if (req.method !== 'POST') return json({ error: 'INVALID_INPUT' }, 405);

  try {
    const adminUserId = await requireAdminUserId(req);
    const body = await readJson(req);

    const name = requireString(body.name, 'name');
    const ownerFullName = requireString(body.owner_full_name, 'owner_full_name');
    const contact = requireString(body.owner_phone_or_email, 'owner_phone_or_email');
    const password = requireString(body.password, 'password');
    const defaultLanguage = body.default_language === 'fr' ? 'fr' : 'ar';
    const city = typeof body.city === 'string' && body.city.trim() !== '' ? body.city.trim() : null;

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new EdgeError('WEAK_PASSWORD', 400, `password must be >= ${MIN_PASSWORD_LENGTH} chars`);
    }

    const isEmail = contact.includes('@');
    const normalizedPhone = isEmail ? null : normalizeDzPhone(contact);
    if (!isEmail && !normalizedPhone) {
      throw new EdgeError('INVALID_INPUT', 400, 'owner_phone_or_email is neither a valid email nor an Algerian phone');
    }
    if (isEmail && !EMAIL_RE.test(contact)) {
      throw new EdgeError('INVALID_INPUT', 400, 'invalid email address');
    }

    const email = isEmail
      ? contact.toLowerCase()
      : phoneToSyntheticEmail(normalizedPhone as string) as string;

    const admin = adminClient();
    const gymId = crypto.randomUUID();

    const { error: gymError } = await admin.from('gyms').insert({
      id: gymId,
      name,
      city,
      default_language: defaultLanguage,
      status: 'active',
      created_by: adminUserId,
    });
    if (gymError) throw new EdgeError('UNKNOWN', 500, `gym insert failed: ${gymError.message}`);

    let ownerUserId: string | null = null;
    try {
      const { data: created, error: userError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // app_metadata is server-owned (not user-writable); user_metadata keeps the
        // current RLS helpers working. Both carry role/gym_id.
        app_metadata: { role: 'owner', gym_id: gymId },
        user_metadata: { role: 'owner', gym_id: gymId, full_name: ownerFullName },
      });

      if (userError || !created.user) {
        const message = (userError?.message ?? '').toLowerCase();
        const code = isEmail
          ? 'EMAIL_TAKEN'
          : /already|exist|duplicate/.test(message)
            ? 'PHONE_TAKEN'
            : 'UNKNOWN';
        throw new EdgeError(code, code === 'UNKNOWN' ? 500 : 409, userError?.message);
      }

      ownerUserId = created.user.id;

      const { error: profileError } = await admin.from('profiles').insert({
        id: ownerUserId,
        gym_id: gymId,
        role: 'owner',
        full_name: ownerFullName,
        phone: normalizedPhone,
        email: isEmail ? email : null,
        language: defaultLanguage,
      });
      if (profileError) throw new EdgeError('UNKNOWN', 500, `profile insert failed: ${profileError.message}`);

      const { error: settingsError } = await admin
        .from('gym_settings')
        .insert({ gym_id: gymId });
      if (settingsError) throw new EdgeError('UNKNOWN', 500, `settings insert failed: ${settingsError.message}`);

      const { error: templatesError } = await admin.from('reminder_templates').insert(
        DEFAULT_REMINDER_TEMPLATES.map((template) => ({
          gym_id: gymId,
          language: template.language,
          kind: template.kind,
          body: template.body,
        })),
      );
      if (templatesError) {
        throw new EdgeError('UNKNOWN', 500, `templates insert failed: ${templatesError.message}`);
      }
    } catch (error) {
      // Best-effort rollback so a failed provisioning leaves no partial gym.
      if (ownerUserId) await admin.auth.admin.deleteUser(ownerUserId).catch(() => undefined);
      await admin.from('gyms').delete().eq('id', gymId);
      throw error;
    }

    await admin.from('audit_log').insert({
      gym_id: gymId,
      actor_id: adminUserId,
      action: 'admin_create_gym',
      entity_type: 'gym',
      entity_id: gymId,
      new_value: { name, city, default_language: defaultLanguage, owner_user_id: ownerUserId },
    });

    return json({
      gym_id: gymId,
      owner_user_id: ownerUserId,
      gym_name: name,
      login: isEmail ? email : normalizedPhone,
      synthetic_email: email,
      password,
    });
  } catch (error) {
    return errorResponse(error);
  }
});
