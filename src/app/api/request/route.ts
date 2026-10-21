import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/supabase/admin';
import { notifyAllocationCreated } from '@/lib/email';
import { allow, clientIp } from '@/lib/ratelimit';
import { EMAIL_RE, normalizeEmail } from '@/lib/format';
import { getSettings } from '@/lib/settings';
import { publicWindowEnd } from '@/lib/games';

export const dynamic = 'force-dynamic';

const SOLD_MESSAGE =
  'Looks like someone beat you to those seats! This game no longer has enough tickets available for your request. Please check the remaining games for another opportunity.';

const Body = z.object({
  gameId: z.string().uuid(),
  fullName: z.string().trim().min(2, 'Please enter your full name.').max(120),
  email: z.string().trim().max(254).regex(EMAIL_RE, 'Please enter a valid email address.'),
  quantity: z.coerce.number().int().min(1, 'Choose how many tickets you need.').max(4, 'You can request up to 4 tickets per game.'),
  idempotencyKey: z.string().min(16).max(80),
  website: z.string().optional(), // honeypot: real people leave this empty
  elapsedMs: z.coerce.number().optional(),
});

function fail(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, code, message, ...extra }, { status });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) {
    return fail(403, 'forbidden', 'Requests must come from this website.');
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return fail(400, 'invalid', 'Something was wrong with that request. Please try again.');
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return fail(400, 'invalid', first?.message ?? 'Please check the form and try again.');
  }
  const b = parsed.data;

  // Bot checks: hidden field filled in, or form submitted inhumanly fast.
  if ((b.website && b.website.trim() !== '') || (b.elapsedMs != null && b.elapsedMs < 1500)) {
    return fail(400, 'blocked', 'We could not process that request. Please try again.');
  }

  const ip = clientIp();
  const email = normalizeEmail(b.email);
  if (!(await allow('req-ip', ip, 10, 600)) || !(await allow('req-email', email, 8, 3600))) {
    return fail(429, 'rate_limited', 'Too many requests in a short time. Please wait a few minutes and try again.');
  }

  // Only games inside the public window can be requested.
  const settings = await getSettings();
  const { data: game } = await db().from('games').select('game_date').eq('id', b.gameId).maybeSingle();
  if (!game || (game as any).game_date > publicWindowEnd(settings.publicWindowDays)) {
    return fail(404, 'not_found', 'That game isn’t open for requests yet. Please pick one of the games shown.');
  }

  const { data, error } = await db().rpc('allocate_tickets', {
    p_game_id: b.gameId,
    p_full_name: b.fullName,
    p_email: email,
    p_quantity: b.quantity,
    p_idempotency_key: b.idempotencyKey,
    p_source: 'public',
    p_actor: `public:${email}`,
  });

  if (error) {
    // The database guard is the last line of defense against overbooking.
    if (error.message?.includes('OVER_ALLOCATION')) return fail(409, 'insufficient', SOLD_MESSAGE);
    console.error('allocate_tickets failed', error.message);
    return fail(500, 'error', 'Something went wrong on our end. Your request was not completed — please try again.');
  }

  const r = data as { ok: boolean; code?: string; remaining?: number; allocation_id?: string; duplicate?: boolean; quantity?: number };

  if (!r.ok) {
    switch (r.code) {
      case 'insufficient':
        return fail(409, 'insufficient', SOLD_MESSAGE, { remaining: r.remaining ?? 0 });
      case 'closed':
        return fail(409, 'closed', 'Requests for this game are closed. Please pick another game.');
      case 'past':
        return fail(409, 'past', 'This game has already started. Please pick another game.');
      case 'invalid_contact':
        return fail(400, 'invalid', 'Please check your name and email address.');
      default:
        return fail(404, 'not_found', 'That game is no longer available. Please refresh the page.');
    }
  }

  if (!r.duplicate && r.allocation_id) {
    await notifyAllocationCreated(r.allocation_id);
  }

  return NextResponse.json({ ok: true, remaining: r.remaining, quantity: r.quantity, duplicate: !!r.duplicate });
}
