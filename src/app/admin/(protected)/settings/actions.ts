'use server';

import { revalidatePath } from 'next/cache';
import { MIN_PASSWORD, USERNAME_RE, requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { saveSettings } from '@/lib/settings';
import { EMAIL_RE, normalizeEmail } from '@/lib/format';
import { done, oops } from '@/lib/flash';

const BACK = '/admin/settings';
const str = (fd: FormData, k: string, max = 4000) => String(fd.get(k) ?? '').trim().slice(0, max);
const HEX = /^#[0-9a-fA-F]{6}$/;

async function save(admin: { email: string }, section: string, patch: Parameters<typeof saveSettings>[0]) {
  try {
    await saveSettings(patch);
  } catch (e) {
    oops(BACK, (e as Error).message);
  }
  await audit(admin.email, 'settings.updated', 'settings', null, { section });
  revalidatePath('/', 'layout');
  done(BACK, 'Settings saved.');
}

export async function saveCopy(fd: FormData) {
  const admin = await requireAdmin();
  const patch = {
    seasonLabel: str(fd, 'seasonLabel', 120),
    headline: str(fd, 'headline', 120),
    intro: str(fd, 'intro'),
    disclaimer: str(fd, 'disclaimer'),
    privacyNotice: str(fd, 'privacyNotice'),
  };
  if (!patch.headline || !patch.seasonLabel) oops(BACK, 'The season label and headline cannot be empty.');
  await save(admin, 'public copy', patch);
}

export async function saveDisplay(fd: FormData) {
  const admin = await requireAdmin();
  const inv = Number(fd.get('defaultInventory'));
  if (!Number.isInteger(inv) || inv < 0 || inv > 50) oops(BACK, 'Default inventory must be 0–50.');
  const windowDays = Number(fd.get('publicWindowDays'));
  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365) oops(BACK, 'The public window must be 1–365 days.');
  const reminderDays = Number(fd.get('reminderDaysBefore'));
  if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 30) oops(BACK, 'Reminders must be 1–30 days before the game.');
  const reminderRecipient = normalizeEmail(str(fd, 'reminderRecipient', 254));
  if (!EMAIL_RE.test(reminderRecipient)) oops(BACK, 'Enter a valid email for game reminders.');
  const colors = ['jazzPrimary', 'jazzAccent', 'mammothPrimary', 'mammothAccent'].map((k) => str(fd, k, 7));
  if (!colors.every((c) => HEX.test(c))) oops(BACK, 'Colors must be hex values like #7A4BC9.');
  await save(admin, 'display', {
    defaultInventory: inv,
    publicWindowDays: windowDays,
    reminderDaysBefore: reminderDays,
    reminderRecipient,
    teamColors: { jazz: { primary: colors[0], accent: colors[1] }, mammoth: { primary: colors[2], accent: colors[3] } },
    display: {
      showVenue: fd.get('showVenue') === 'on',
      showTotalInventory: fd.get('showTotalInventory') === 'on',
      defaultTab: fd.get('defaultTab') === 'mammoth' ? 'mammoth' : 'jazz',
    },
  });
}

export async function saveRecipients(fd: FormData) {
  const admin = await requireAdmin();
  const list = Array.from(new Set(str(fd, 'recipients').split(/[\s,;]+/).map(normalizeEmail).filter(Boolean)));
  const bad = list.filter((e) => !EMAIL_RE.test(e));
  if (bad.length) oops(BACK, `Not a valid email: ${bad.join(', ')}`);
  if (!list.length) oops(BACK, 'Add at least one notification recipient.');
  await save(admin, 'notification recipients', { notificationRecipients: list });
}

export async function saveEmailTemplates(fd: FormData) {
  const admin = await requireAdmin();
  const internalSubject = str(fd, 'internalSubject', 300);
  if (!internalSubject) oops(BACK, 'The subject line cannot be empty.');
  await save(admin, 'email templates', { email: { internalSubject } as any });
}

export async function addAdmin(fd: FormData) {
  const admin = await requireAdmin();
  const username = str(fd, 'username', 40).toLowerCase();
  const email = normalizeEmail(str(fd, 'email', 254)) || null;
  const password = String(fd.get('password') ?? '');
  const role = fd.get('role') === 'owner' ? 'owner' : 'admin';
  if (!USERNAME_RE.test(username)) oops(BACK, 'Usernames are 3–40 characters: lowercase letters, numbers, dots, dashes or underscores.');
  if (email && !EMAIL_RE.test(email)) oops(BACK, 'That email address isn’t valid (or leave it blank).');
  if (password.length < MIN_PASSWORD) oops(BACK, `The temporary password needs at least ${MIN_PASSWORD} characters.`);
  const { data: existing } = await db().from('admins').select('id').eq('username', username).maybeSingle();
  if (existing) oops(BACK, 'That username is already taken.');
  const { error } = await db().from('admins').insert({ username, email, role, is_active: true, auth_provider: 'password' });
  if (error) oops(BACK, error.message.includes('duplicate') ? 'That email is already used by another administrator.' : error.message);
  const { error: pwErr } = await db().rpc('admin_set_password', { p_username: username, p_password: password, p_must_change: true });
  if (pwErr) oops(BACK, pwErr.message);
  await audit(admin.username, 'admin.added', 'admin', null, { username, role });
  done(BACK, `Added ${username}. Share the temporary password with them privately; they'll choose their own when they first sign in.`);
}

export async function resetAdminPassword(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get('id'));
  const password = String(fd.get('password') ?? '');
  if (id === admin.id) oops(BACK, 'To change your own password, click your username at the top of the page.');
  if (password.length < MIN_PASSWORD) oops(BACK, `The temporary password needs at least ${MIN_PASSWORD} characters.`);
  const { data: target } = await db().from('admins').select('username').eq('id', id).single();
  if (!target) oops(BACK, 'Administrator not found.');
  const { error } = await db().rpc('admin_set_password', { p_username: (target as any).username, p_password: password, p_must_change: true });
  if (error) oops(BACK, error.message);
  await audit(admin.username, 'admin.password_reset', 'admin', id, { username: (target as any).username });
  done(BACK, `Password reset for ${(target as any).username}. They'll choose a new one at their next sign-in.`);
}

export async function setAdminActive(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get('id'));
  const active = fd.get('active') === 'true';
  if (id === admin.id) oops(BACK, 'You cannot deactivate your own account.');
  if (!active) {
    const { count } = await db().from('admins').select('id', { count: 'exact', head: true }).eq('is_active', true);
    if ((count ?? 0) <= 1) oops(BACK, 'At least one administrator must stay active.');
  }
  const { data, error } = await db().from('admins').update({ is_active: active }).eq('id', id).select('username').single();
  if (error) oops(BACK, error.message);
  if (!active) await db().from('admin_sessions').delete().eq('admin_id', id);
  await audit(admin.username, 'admin.updated', 'admin', id, { username: (data as any)?.username, active });
  done(BACK, active ? 'Administrator reactivated.' : 'Administrator deactivated and signed out. They can no longer access the dashboard.');
}
