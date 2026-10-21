'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { audit } from '@/lib/audit';
import { ensureClient } from '@/lib/clients';
import { getSettings } from '@/lib/settings';
import { readCsvFile, truthy } from '@/lib/csv';
import { parseDateInput, parseTime } from '@/lib/format';
import { done, oops } from '@/lib/flash';
import { sendGameReminder } from '@/lib/email';

function refresh() {
  revalidatePath('/', 'layout');
}

function readGameForm(formData: FormData) {
  const team = String(formData.get('team'));
  const opponent = String(formData.get('opponent') ?? '').trim();
  const game_date = parseDateInput(String(formData.get('game_date') ?? ''));
  const start_time = parseTime(String(formData.get('start_time') ?? ''));
  const venue = String(formData.get('venue') ?? '').trim() || 'Delta Center';
  const inventory = Number(formData.get('total_inventory'));
  const notes = String(formData.get('notes') ?? '').slice(0, 5000) || null;
  const is_published = formData.get('is_published') === 'on';
  if (!['jazz', 'mammoth'].includes(team)) return { error: 'Choose a team.' } as const;
  if (!opponent) return { error: 'Enter the opponent.' } as const;
  if (!game_date) return { error: 'Enter a valid date.' } as const;
  if (!start_time) return { error: 'Enter a valid start time, like 7:30 PM.' } as const;
  if (!Number.isInteger(inventory) || inventory < 0 || inventory > 50) return { error: 'Inventory must be a whole number from 0 to 50.' } as const;
  return { value: { team, opponent, game_date, start_time, venue, notes, is_published }, inventory } as const;
}

const friendly = (m: string) => (m.includes('games_team_game_date_key') || m.includes('duplicate') ? 'That team already has a game on that date.' : m);

export async function createGame(formData: FormData) {
  const admin = await requireAdmin();
  const f = readGameForm(formData);
  if ('error' in f) oops('/admin/games/new', f.error!);
  const { data, error } = await db()
    .from('games')
    .insert({ ...f.value, total_inventory: f.inventory })
    .select('id')
    .single();
  if (error) oops('/admin/games/new', friendly(error.message));
  await audit(admin.email, 'game.created', 'game', (data as any).id, { ...f.value, inventory: f.inventory });
  refresh();
  done(`/admin/games/${(data as any).id}`, 'Game added.');
}

export async function updateGame(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const back = `/admin/games/${id}`;
  const f = readGameForm(formData);
  if ('error' in f) oops(back, f.error!);

  // Inventory goes through the locked, checked function.
  const { data: inv, error: invErr } = await db().rpc('admin_set_game_inventory', { p_game_id: id, p_inventory: f.inventory, p_actor: admin.email });
  if (invErr) oops(back, invErr.message);
  if (!(inv as any).ok) {
    if ((inv as any).code === 'below_allocated')
      oops(
        back,
        `Inventory can't go below the ${(inv as any).allocated} seats already allocated. Cancel or reduce allocations first, then lower the inventory.`,
      );
    oops(back, 'That inventory value is not valid.');
  }

  const { data: before } = await db().from('games').select('*').eq('id', id).single();
  const { error } = await db().from('games').update(f.value).eq('id', id);
  if (error) oops(back, friendly(error.message));

  const b = before as any;
  const changes: Record<string, string> = {};
  for (const k of ['team', 'opponent', 'game_date', 'venue', 'notes'] as const) {
    if ((b[k] ?? '') !== ((f.value as any)[k] ?? '')) changes[k] = `${b[k] ?? ''} → ${(f.value as any)[k] ?? ''}`;
  }
  if (String(b.start_time).slice(0, 5) !== f.value.start_time) changes.start_time = `${String(b.start_time).slice(0, 5)} → ${f.value.start_time}`;
  if (Object.keys(changes).length) await audit(admin.email, 'game.updated', 'game', id, changes);
  if (b.is_published !== f.value.is_published) await audit(admin.email, f.value.is_published ? 'game.published' : 'game.unpublished', 'game', id);
  refresh();
  done(back, 'Game saved.');
}

export async function setClosed(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const closed = formData.get('closed') === 'true';
  const { error } = await db().from('games').update({ is_closed: closed }).eq('id', id);
  if (error) oops(`/admin/games/${id}`, error.message);
  await audit(admin.email, closed ? 'game.closed' : 'game.reopened', 'game', id);
  refresh();
  done(`/admin/games/${id}`, closed ? 'Game closed. No new requests will be accepted.' : 'Game reopened for requests.');
}

export async function setPublished(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const pub = formData.get('published') === 'true';
  const back = String(formData.get('return_to') ?? '').startsWith('/admin') ? String(formData.get('return_to')) : `/admin/games/${id}`;
  const { error } = await db().from('games').update({ is_published: pub }).eq('id', id);
  if (error) oops(back, error.message);
  await audit(admin.email, pub ? 'game.published' : 'game.unpublished', 'game', id);
  refresh();
  done(back, pub ? 'Published — the game now appears on the public site.' : 'Unpublished — the game is hidden from the public site.');
}

export async function deleteGame(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const { data: g } = await db().from('games').select('opponent,game_date,team,is_published').eq('id', id).single();
  if ((g as any)?.is_published) oops(`/admin/games/${id}`, 'Unpublish the game before deleting it.');
  const { count } = await db().from('allocations').select('id', { count: 'exact', head: true }).eq('game_id', id);
  if (count) oops(`/admin/games/${id}`, 'Games with allocations (including cancelled ones) cannot be deleted. Close or unpublish it instead.');
  const { error } = await db().from('games').delete().eq('id', id);
  if (error) oops(`/admin/games/${id}`, error.message);
  await audit(admin.email, 'game.deleted', 'game', id, g as any);
  refresh();
  done('/admin/games', 'Game deleted.');
}

export async function addAllocation(formData: FormData) {
  const admin = await requireAdmin();
  const gameId = String(formData.get('game_id'));
  const back = `/admin/games/${gameId}`;
  const qty = Number(formData.get('quantity'));
  const note = String(formData.get('note') ?? '').trim().slice(0, 2000);
  let clientId = String(formData.get('client_id') ?? '');
  const newName = String(formData.get('new_name') ?? '').trim();
  const newEmail = String(formData.get('new_email') ?? '').trim();
  try {
    if (newName || newEmail) clientId = await ensureClient(newName, newEmail || null, admin.email);
  } catch (e) {
    oops(back, (e as Error).message);
  }
  if (!clientId) oops(back, 'Choose someone from the list or type the name the seats are reserved for.');

  const { data, error } = await db().rpc('allocate_tickets', {
    p_game_id: gameId,
    p_full_name: null,
    p_email: null,
    p_quantity: qty,
    p_idempotency_key: null,
    p_source: 'admin',
    p_actor: admin.email,
    p_client_id: clientId,
  });
  if (error) oops(back, error.message.includes('OVER_ALLOCATION') ? 'Not enough seats remain for that many tickets.' : error.message);
  const r = data as any;
  if (!r.ok) oops(back, r.code === 'insufficient' ? `Only ${r.remaining} seats remain.` : 'Could not reserve those seats.');
  await db().from('allocations').update({ reserved_by: admin.username, notes: note || null }).eq('id', r.allocation_id);
  refresh();
  done(back, `Reserved ${qty} ${qty === 1 ? 'seat' : 'seats'}. No email was sent.`);
}

export async function importGames(formData: FormData) {
  const admin = await requireAdmin();
  const settings = await getSettings();
  let rows: Record<string, string>[] = [];
  try {
    rows = await readCsvFile(formData.get('file') as File | null);
  } catch (e) {
    oops('/admin/games', (e as Error).message);
  }
  const valid: Record<string, unknown>[] = [];
  const bad: number[] = [];
  rows.forEach((r, i) => {
    const team = (r.team ?? '').trim().toLowerCase().replace(/^utah\s+/, '');
    const game_date = parseDateInput(r.date ?? r.game_date ?? '');
    const start_time = parseTime(r.time ?? r.start_time ?? '');
    const opponent = (r.opponent ?? '').trim();
    const inv = r.inventory ? Number(r.inventory) : settings.defaultInventory;
    if (!['jazz', 'mammoth'].includes(team) || !game_date || !start_time || !opponent || !Number.isInteger(inv) || inv < 0 || inv > 50) {
      bad.push(i + 2);
      return;
    }
    valid.push({
      team,
      opponent,
      game_date,
      start_time,
      venue: (r.venue ?? '').trim() || 'Delta Center',
      total_inventory: inv,
      is_published: truthy(r.published, false),
    });
  });
  let added = 0;
  if (valid.length) {
    const { data, error } = await db().from('games').upsert(valid, { onConflict: 'team,game_date', ignoreDuplicates: true }).select('id');
    if (error) oops('/admin/games', error.message);
    added = data?.length ?? 0;
  }
  await audit(admin.email, 'game.imported', 'game', null, { added, skipped_existing: valid.length - added, invalid_rows: bad.length });
  refresh();
  done(
    '/admin/games',
    `Imported ${added} new ${added === 1 ? 'game' : 'games'}; ${valid.length - added} already existed.${bad.length ? ` Skipped invalid rows: ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? '…' : ''}.` : ''}`,
  );
}

export async function sendReminderNow(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get('id'));
  const back = `/admin/games/${id}`;
  await db().from('games').update({ reminder_sent_at: new Date().toISOString() }).eq('id', id);
  const ok = await sendGameReminder(id);
  await audit(admin.email, 'game.reminder_sent', 'game', id, { manual: true, result: ok ? 'sent' : 'failed' });
  revalidatePath(back);
  if (ok) done(back, 'Reminder sent.');
  oops(back, 'The reminder could not be sent. See Emails for the reason, where you can also retry it.');
}
