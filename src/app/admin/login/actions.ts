'use server';

import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { startSession } from '@/lib/auth';
import { allow, clientIp } from '@/lib/ratelimit';

export type LoginState = { error?: string };

export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!username || !password) return { error: 'Enter your username and password.' };
  if (!(await allow('login-ip', clientIp(), 10, 900)) || !(await allow('login-user', username, 6, 900))) {
    return { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' };
  }
  const { data, error } = await db().rpc('admin_check_password', { p_username: username, p_password: password });
  if (error) {
    console.error('admin_check_password failed', error.message);
    return { error: 'Sign-in is unavailable right now. Please try again in a minute.' };
  }
  if (!data) return { error: 'That username and password don’t match an active administrator.' };
  await startSession(data as string);
  redirect('/admin');
}
