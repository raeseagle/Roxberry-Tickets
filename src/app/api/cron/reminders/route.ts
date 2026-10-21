import { NextResponse } from 'next/server';
import { sendDueReminders } from '@/lib/email';
import { allow, clientIp } from '@/lib/ratelimit';

export const dynamic = 'force-dynamic';

/**
 * Called every morning by the scheduled function in netlify/functions/game-reminders.mjs.
 * Safe to call more than once: each game is reminded only once, ever, and the
 * response reveals nothing but counts.
 */
export async function POST() {
  if (!(await allow('cron', clientIp(), 6, 3600))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 });
  }
  const result = await sendDueReminders();
  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
}
