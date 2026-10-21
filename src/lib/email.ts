import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { db } from './supabase/admin';
import { getSettings, type AppSettings } from './settings';
import { teamName } from './teams';
import { addDaysIso, fmtDateLong, fmtStamp, fmtTime, todayInSlc } from './format';

import type { NotificationType } from './email-labels';
export { NOTIFICATION_LABELS, type NotificationType } from './email-labels';

type Ctx = {
  id: string;
  quantity: number;
  status: string;
  requested_at: string;
  client: { full_name: string; email: string };
  game: { team: string; opponent: string; game_date: string; start_time: string; venue: string; total_inventory: number };
  remaining: number;
};

let transporter: Transporter | null = null;
function mailer() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

/** Log label used when the alert goes out through Netlify Forms notifications. */
export const NETLIFY_RECIPIENT = 'Netlify form notification';

/**
 * Submits the hidden "ticket-allocated" form (public/__forms.html). Netlify then
 * emails the submission to the addresses set under Site configuration →
 * Notifications → Form submission notifications.
 */
async function postNetlifyForm(c: Ctx) {
  const site = siteUrl();
  if (!site) throw new Error('NEXT_PUBLIC_SITE_URL is not set, so the alert form cannot be submitted.');
  const body = new URLSearchParams({
    'form-name': 'ticket-allocated',
    'bot-field': '',
    client_name: c.client.full_name,
    client_email: c.client.email,
    tickets: String(c.quantity),
    game: `${teamName(c.game.team)} vs. ${c.game.opponent}`,
    game_date: fmtDateLong(c.game.game_date),
    start_time: `${fmtTime(c.game.start_time)} MT`,
    venue: c.game.venue,
    seats_remaining: `${c.remaining} of ${c.game.total_inventory}`,
    requested_at: `${fmtStamp(c.requested_at)} MT`,
    dashboard_link: `${site}/admin/allocations/${c.id}`,
  });
  const res = await fetch(`${site}/__forms.html`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'Netlify did not accept the alert form (404). Turn on Forms → Enable form detection in Netlify, then redeploy.'
        : `Netlify form submission failed with status ${res.status}.`,
    );
  }
  return { id: null };
}

export function emailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

function esc(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadContext(allocationId: string): Promise<Ctx | null> {
  const { data } = await db()
    .from('allocations')
    .select(
      'id,quantity,status,requested_at,game_id,clients(full_name,email),games(team,opponent,game_date,start_time,venue,total_inventory)',
    )
    .eq('id', allocationId)
    .maybeSingle();
  if (!data) return null;
  const row = data as any;
  const { data: av } = await db().from('game_availability').select('remaining').eq('id', row.game_id).maybeSingle();
  return {
    id: row.id,
    quantity: row.quantity,
    status: row.status,
    requested_at: row.requested_at,
    client: row.clients,
    game: row.games,
    remaining: (av as any)?.remaining ?? 0,
  };
}

function fill(tpl: string, c: Ctx) {
  return tpl
    .replace(/\{team\}/g, teamName(c.game.team))
    .replace(/\{opponent\}/g, c.game.opponent)
    .replace(/\{date\}/g, fmtDateLong(c.game.game_date))
    .replace(/\{time\}/g, `${fmtTime(c.game.start_time)} MT`)
    .replace(/\{name\}/g, c.client.full_name)
    .replace(/\{quantity\}/g, String(c.quantity));
}

function layout(eyebrow: string, title: string, intro: string, rows: [string, string][], footer: string, cta?: { href: string; label: string }) {
  const rowHtml = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#DDB9DB;font-size:13px;width:42%;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#ffffff;font-size:15px;font-weight:600">${esc(v)}</td></tr>`,
    )
    .join('');
  const button = cta
    ? `<p style="margin:28px 0 0"><a href="${esc(cta.href)}" style="background:#ffffff;color:#5C0E5A;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px">${esc(cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#4A0A48;font-family:Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#4A0A48;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#5C0E5A;border:1px solid #9C3F99;border-radius:10px">
<tr><td style="padding:28px 28px 8px"><p style="margin:0;color:#EED9ED;font-size:12px;letter-spacing:2px">${esc(eyebrow)}</p>
<h1 style="margin:10px 0 0;color:#ffffff;font-size:24px;line-height:1.25">${esc(title)}</h1></td></tr>
<tr><td style="padding:12px 28px 4px;color:#F8EEF7;font-size:15px;line-height:1.55">${esc(intro).replace(/\n/g, '<br>')}</td></tr>
<tr><td style="padding:8px 28px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #9C3F99">${rowHtml}</table>${button}</td></tr>
<tr><td style="padding:20px 28px 28px;color:#DDB9DB;font-size:13px;line-height:1.5">${esc(footer).replace(/\n/g, '<br>')}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [title, '', intro, '', ...rows.map(([k, v]) => `${k}: ${v}`), cta ? `\n${cta.label}: ${cta.href}` : '', '', footer].join('\n');
  return { html, text };
}

function render(type: NotificationType, c: Ctx, s: AppSettings, context: Record<string, unknown>) {
  const game: [string, string][] = [
    ['Game', `${teamName(c.game.team)} vs. ${c.game.opponent}`],
    ['Date', fmtDateLong(c.game.game_date)],
    ['Start time', `${fmtTime(c.game.start_time)} (Salt Lake City time)`],
    ['Venue', c.game.venue],
  ];
  const e = s.email;
  switch (type) {
    case 'internal_allocation': {
      const subject = fill(e.internalSubject, c);
      const body = layout(
        s.seasonLabel,
        'Tickets allocated',
        `${c.client.full_name} just claimed ${c.quantity} ${c.quantity === 1 ? 'ticket' : 'tickets'}.`,
        [
          ['Client name', c.client.full_name],
          ['Client email', c.client.email],
          ['Tickets allocated', String(c.quantity)],
          ...game,
          ['Seats remaining', `${c.remaining} of ${c.game.total_inventory}`],
          ['Requested at', `${fmtStamp(c.requested_at)} MT`],
        ],
        'Sent automatically by the season ticket site.',
        { href: `${siteUrl()}/admin/allocations/${c.id}`, label: 'Open in dashboard' },
      );
      return { subject, ...body };
    }
    default:
      throw new Error(`No template for ${type}`);
  }
}

async function deliver(logId: string, attemptsSoFar: number) {
  const { data: log } = await db().from('email_logs').select('*').eq('id', logId).single();
  const l = log as any;
  const now = new Date().toISOString();
  const fail = (msg: string) =>
    db().from('email_logs').update({ status: 'failed', error: msg.slice(0, 1000), attempts: attemptsSoFar + 1, attempted_at: now }).eq('id', logId);

  if (l.notification_type === 'game_reminder') {
    try {
      const id = await deliverReminder(l);
      await db()
        .from('email_logs')
        .update({ status: 'sent', error: null, provider_message_id: id, attempts: attemptsSoFar + 1, attempted_at: now })
        .eq('id', logId);
    } catch (err) {
      await fail(err instanceof Error ? err.message : String(err));
    }
    return;
  }
  if (!l.allocation_id) return fail('The related allocation no longer exists.');
  const ctx = await loadContext(l.allocation_id);
  if (!ctx) return fail('The related allocation no longer exists.');
  const settings = await getSettings();
  const msg = render(l.notification_type as NotificationType, ctx, settings, l.context ?? {});

  try {
    let data: { id: string | null };
    if (l.recipient === NETLIFY_RECIPIENT) {
      data = await postNetlifyForm(ctx);
    } else {
      if (!emailConfigured()) throw new Error('Email is not configured yet (SMTP_HOST, SMTP_USER and SMTP_PASS).');
      const info = await mailer().sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: l.recipient,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        replyTo: process.env.EMAIL_REPLY_TO || undefined,
      });
      data = { id: info.messageId };
    }
    await db()
      .from('email_logs')
      .update({ status: 'sent', subject: msg.subject, provider_message_id: data?.id ?? null, error: null, attempts: attemptsSoFar + 1, attempted_at: now })
      .eq('id', logId);
  } catch (err) {
    await db().from('email_logs').update({ subject: msg.subject }).eq('id', logId);
    await fail(err instanceof Error ? err.message : String(err));
  }
}

/** Creates a log entry and attempts delivery. Never throws. */
export async function sendNotification(
  allocationId: string,
  type: NotificationType,
  recipient: string,
  context: Record<string, unknown> = {},
) {
  try {
    const { data, error } = await db()
      .from('email_logs')
      .insert({ allocation_id: allocationId, notification_type: type, recipient, context, status: 'pending' })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Could not create email log');
    await deliver((data as any).id, 0);
  } catch (err) {
    console.error('sendNotification failed', err);
  }
}

/**
 * Alerts the Roxberry team. Clients are never emailed by the site.
 * Default: one Netlify Forms submission (Netlify emails everyone set up in its notifications).
 * If SMTP settings exist, emails each address in Settings → Notification recipients instead.
 */
export async function notifyAllocationCreated(allocationId: string) {
  if (!emailConfigured()) {
    await sendNotification(allocationId, 'internal_allocation', NETLIFY_RECIPIENT);
    return;
  }
  const settings = await getSettings();
  await Promise.all(settings.notificationRecipients.map((r) => sendNotification(allocationId, 'internal_allocation', r)));
}

/** Retries a failed email. Only touches the email log, never the allocation. */
export async function retryEmail(logId: string) {
  // Claim the row so two retries can't send twice.
  const { data } = await db()
    .from('email_logs')
    .update({ status: 'pending' })
    .eq('id', logId)
    .eq('status', 'failed')
    .select('id,attempts');
  const row = (data as any[])?.[0];
  if (!row) return false;
  await deliver(row.id, row.attempts ?? 0);
  return true;
}


// ---------------------------------------------------------------------
// Game reminders ("3 days out"), sent to the team whether or not seats are claimed.
// ---------------------------------------------------------------------

type ReminderCtx = {
  game: { id: string; team: string; opponent: string; game_date: string; start_time: string; venue: string; total_inventory: number; allocated: number; remaining: number; is_closed: boolean; is_published: boolean };
  clients: { name: string; email: string; quantity: number; reserved: boolean }[];
};

async function loadReminderContext(gameId: string): Promise<ReminderCtx | null> {
  const { data: g } = await db().from('game_availability').select('*').eq('id', gameId).maybeSingle();
  if (!g) return null;
  const { data: allocs } = await db()
    .from('allocations')
    .select('quantity,source,clients(full_name,email)')
    .eq('game_id', gameId)
    .eq('status', 'confirmed')
    .order('requested_at');
  return {
    game: g as any,
    clients: ((allocs ?? []) as any[]).map((a) => ({ name: a.clients?.full_name ?? '', email: a.clients?.email ?? '', quantity: a.quantity, reserved: a.source === 'admin' })),
  };
}

function reminderFields(c: ReminderCtx) {
  const g = c.game;
  const status = g.is_closed
    ? 'Closed to requests'
    : g.remaining === 0
      ? 'All seats claimed — send tickets to these clients'
      : g.allocated === 0
        ? 'No seats claimed — consider selling or offering these tickets'
        : `${g.remaining} unclaimed — send tickets to these clients and decide on the rest`;
  return {
    game: `${teamName(g.team)} vs. ${g.opponent}`,
    game_date: fmtDateLong(g.game_date),
    start_time: `${fmtTime(g.start_time)} MT`,
    venue: g.venue,
    seats_total: String(g.total_inventory),
    seats_claimed: String(g.allocated),
    seats_unclaimed: String(g.remaining),
    status,
    clients: c.clients.length ? c.clients.map((x) => `${x.name}${x.email ? ` (${x.email})` : ''} — ${x.quantity} ${x.quantity === 1 ? 'ticket' : 'tickets'}${x.reserved ? ' [reserved]' : ''}`).join('\n') : 'None yet',
    dashboard_link: `${siteUrl()}/admin/games/${g.id}`,
  };
}

async function deliverReminder(l: any): Promise<string | null> {
  const gameId = (l.context ?? {}).game_id as string | undefined;
  if (!gameId) throw new Error('Reminder is missing its game.');
  const ctx = await loadReminderContext(gameId);
  if (!ctx) throw new Error('That game no longer exists.');
  const f = reminderFields(ctx);
  const subject = `Reminder: ${f.game} — ${f.game_date}`;
  await db().from('email_logs').update({ subject }).eq('id', l.id);

  if (l.recipient === NETLIFY_RECIPIENT) {
    const site = siteUrl();
    if (!site) throw new Error('NEXT_PUBLIC_SITE_URL is not set, so the reminder form cannot be submitted.');
    const res = await fetch(`${site}/__forms.html`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'form-name': 'game-reminder', 'bot-field': '', ...f }).toString(),
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(
        res.status === 404
          ? 'Netlify did not accept the reminder form (404). Make sure form detection is on and the site has been redeployed.'
          : `Netlify form submission failed with status ${res.status}.`,
      );
    }
    return null;
  }

  if (!emailConfigured()) throw new Error('Email is not configured yet (SMTP_HOST, SMTP_USER and SMTP_PASS).');
  const settings = await getSettings();
  const body = layout(
    settings.seasonLabel,
    `${f.game} is coming up`,
    f.status,
    [
      ['Date', f.game_date],
      ['Start time', f.start_time],
      ['Venue', f.venue],
      ['Seats claimed', `${f.seats_claimed} of ${f.seats_total}`],
      ['Unclaimed', f.seats_unclaimed],
      ['Clients', f.clients.replace(/\n/g, '; ')],
    ],
    'Sent automatically by the season ticket site.',
    { href: f.dashboard_link, label: 'Open this game' },
  );
  const info = await mailer().sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to: l.recipient,
    subject,
    html: body.html,
    text: body.text,
  });
  return info.messageId ?? null;
}

/** Logs and sends one reminder for a game. Never throws. */
export async function sendGameReminder(gameId: string) {
  const settings = await getSettings();
  const recipient = emailConfigured() ? settings.reminderRecipient : NETLIFY_RECIPIENT;
  try {
    const { data, error } = await db()
      .from('email_logs')
      .insert({ allocation_id: null, notification_type: 'game_reminder', recipient, context: { game_id: gameId }, status: 'pending' })
      .select('id')
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Could not create email log');
    await deliver((data as any).id, 0);
    const { data: after } = await db().from('email_logs').select('status').eq('id', (data as any).id).single();
    return (after as any)?.status === 'sent';
  } catch (err) {
    console.error('sendGameReminder failed', err);
    return false;
  }
}

/**
 * Sends reminders for every game happening within the next `daysBefore` days
 * that hasn't had one yet. Each game is claimed atomically first, so running
 * this twice (or two runs at once) never sends a duplicate.
 */
export async function sendDueReminders() {
  const settings = await getSettings();
  const today = todayInSlc();
  const until = addDaysIso(today, settings.reminderDaysBefore);
  const { data: due } = await db()
    .from('games')
    .select('id')
    .is('reminder_sent_at', null)
    .gt('starts_at', new Date().toISOString())
    .lte('game_date', until)
    .order('starts_at');
  let sent = 0;
  let failed = 0;
  for (const row of (due ?? []) as any[]) {
    const { data: claimed } = await db()
      .from('games')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', row.id)
      .is('reminder_sent_at', null)
      .select('id');
    if (!claimed?.length) continue; // another run already took it
    if (await sendGameReminder(row.id)) sent++;
    else failed++;
  }
  return { checked: due?.length ?? 0, sent, failed };
}
