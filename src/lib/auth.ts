import 'server-only';
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from './supabase/admin';

export const SESSION_COOKIE = 'tickets_admin_session';
const SESSION_DAYS = 7;

export type Admin = {
  id: string;
  username: string;
  role: 'owner' | 'admin';
  mustChangePassword: boolean;
  /** Label recorded in the activity log for this person's changes. */
  email: string;
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session for an admin and sets the sign-in cookie. Call from a server action. */
export async function startSession(adminId: string) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  const { error } = await db().from('admin_sessions').insert({ admin_id: adminId, token_hash: hash(token), expires_at: expires.toISOString() });
  if (error) throw new Error(error.message);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
  // Tidy up expired sessions now and then.
  if (Math.random() < 0.1) await db().from('admin_sessions').delete().lt('expires_at', new Date().toISOString());
}

export async function endSession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await db().from('admin_sessions').delete().eq('token_hash', hash(token));
  cookies().delete(SESSION_COOKIE);
}

/** The signed-in, active administrator, or null. Checked against the database on every call. */
export async function getAdmin(): Promise<Admin | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20) return null;
  const { data } = await db()
    .from('admin_sessions')
    .select('expires_at, admins(id, username, role, is_active, must_change_password)')
    .eq('token_hash', hash(token))
    .maybeSingle();
  const row = data as any;
  const a = row?.admins;
  if (!a || !a.is_active || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: a.id, username: a.username, role: a.role, mustChangePassword: a.must_change_password, email: a.username };
}

/** Use at the top of every admin page and server action. */
export async function requireAdmin(opts: { allowPasswordChange?: boolean } = {}): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  if (admin.mustChangePassword && !opts.allowPasswordChange) redirect('/admin/password');
  return admin;
}

export const USERNAME_RE = /^[a-z0-9._-]{3,40}$/;
export const MIN_PASSWORD = 10;
