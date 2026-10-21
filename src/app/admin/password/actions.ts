'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { MIN_PASSWORD, requireAdmin, startSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export type PwState = { error?: string };

export async function changePassword(_prev: PwState, formData: FormData): Promise<PwState> {
  const admin = await requireAdmin({ allowPasswordChange: true });
  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('next') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (next.length < MIN_PASSWORD) return { error: `Your new password needs at least ${MIN_PASSWORD} characters.` };
  if (next !== confirm) return { error: 'The two new passwords don’t match.' };
  if (next === current) return { error: 'Choose a password different from your current one.' };

  const { data: ok } = await db().rpc('admin_check_password', { p_username: admin.username, p_password: current });
  if (!ok) return { error: 'Your current password is incorrect.' };

  const { error } = await db().rpc('admin_set_password', { p_username: admin.username, p_password: next, p_must_change: false });
  if (error) return { error: error.message };
  await audit(admin.username, 'admin.password_changed', 'admin', admin.id);
  // Setting a password signs out all sessions; start a fresh one here.
  await startSession(admin.id);
  redirect('/admin?msg=' + encodeURIComponent('Password updated.'));
}
