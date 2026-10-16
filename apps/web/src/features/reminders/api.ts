// Reminders reads (DATA-CONTRACT.md rows 13/15). Writes go through runMutation
// (FRONTEND-BACKEND.md §6); reminders + settings are ONLINE-ONLY (Phase 9).

import { supabase } from '../../lib/supabase';
import { toAppError } from '../../lib/pg-errors';
import type { Enums, Reminder, ReminderTemplate } from '../../lib/database.types';

export interface DueReminder {
  member_id: string;
  subscription_id: string;
  end_date: string;
  full_name: string;
  phone: string;
  language: Enums<'lang'>;
  kind: Enums<'reminder_kind'>;
}

/** Members due for a reminder (respects settings; excludes frozen/renewed). */
export async function fetchRemindersDue(gymId: string, date: string): Promise<DueReminder[]> {
  const { data, error } = await supabase.rpc('reminders_due', { p_gym_id: gymId, p_date: date });
  if (error) throw toAppError(error);
  return data ?? [];
}

export interface ReminderLogEntry {
  id: string;
  member_id: string;
  kind: Enums<'reminder_kind'>;
  channel: Enums<'channel'>;
  language: Enums<'lang'>;
  body_rendered: string;
  status: Enums<'reminder_status'>;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
  member: { full_name: string; phone: string } | null;
}

/** Recent reminder log, newest first; optionally scoped to one member. */
export async function fetchReminderLog(gymId: string, memberId?: string): Promise<ReminderLogEntry[]> {
  let query = supabase
    .from('reminders')
    .select(
      'id, member_id, kind, channel, language, body_rendered, status, scheduled_for, sent_at, created_at, member:members(full_name, phone)',
    )
    .eq('gym_id', gymId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (memberId) query = query.eq('member_id', memberId);

  const { data, error } = await query;
  if (error) throw toAppError(error);
  return (data ?? []) as unknown as ReminderLogEntry[];
}

export async function fetchReminderTemplates(gymId: string): Promise<ReminderTemplate[]> {
  const { data, error } = await supabase.from('reminder_templates').select('*').eq('gym_id', gymId);
  if (error) throw toAppError(error);
  return data ?? [];
}

export type ManualReminderResult = Reminder;
