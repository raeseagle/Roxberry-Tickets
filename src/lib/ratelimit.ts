import 'server-only';
import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { db } from './supabase/admin';

export function clientIp() {
  const h = headers();
  return (
    h.get('x-nf-client-connection-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

/** Stores only a hash of the IP. Returns true when allowed. Fails open if the DB is unreachable. */
export async function allow(bucket: string, id: string, max: number, windowSeconds: number) {
  const key = `${bucket}:${createHash('sha256').update(id).digest('hex').slice(0, 32)}`;
  const { data, error } = await db().rpc('hit_rate_limit', { p_key: key, p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.error('rate limit check failed', error.message);
    return true;
  }
  return data === true;
}
