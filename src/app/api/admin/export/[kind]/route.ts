import { NextResponse, type NextRequest } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { db } from '@/lib/supabase/admin';
import { getAllGames } from '@/lib/games';
import { csvResponse, toCsv } from '@/lib/csv';
import { fmtStamp } from '@/lib/format';
import { teamName } from '@/lib/teams';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  if (!(await getAdmin())) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 });
  const stamp = new Date().toISOString().slice(0, 10);

  if (params.kind === 'games') {
    const games = await getAllGames();
    const rows = games.map((g) => ({
      team: g.team,
      opponent: g.opponent,
      date: g.game_date,
      time: g.start_time.slice(0, 5),
      venue: g.venue,
      inventory: g.total_inventory,
      allocated: g.allocated,
      remaining: g.remaining,
      published: g.is_published ? 'yes' : 'no',
      closed: g.is_closed ? 'yes' : 'no',
      notes: g.notes ?? '',
    }));
    return csvResponse(
      toCsv(rows, ['team', 'opponent', 'date', 'time', 'venue', 'inventory', 'allocated', 'remaining', 'published', 'closed', 'notes']),
      `games-${stamp}.csv`,
    );
  }

  if (params.kind === 'clients') {
    const { data } = await db().from('clients').select('*').order('full_name');
    const rows = ((data ?? []) as any[]).map((c) => ({
      full_name: c.full_name,
      email: c.email,
      active: c.is_active ? 'yes' : 'no',
      archived: c.is_archived ? 'yes' : 'no',
      notes: c.notes ?? '',
      created: fmtStamp(c.created_at),
    }));
    return csvResponse(toCsv(rows, ['full_name', 'email', 'active', 'archived', 'notes', 'created']), `clients-${stamp}.csv`);
  }

  if (params.kind === 'allocations') {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get('q') ?? '').toLowerCase();
    const team = sp.get('team') ?? 'all';
    const status = sp.get('status') ?? 'all';
    const when = sp.get('when') ?? 'all';
    const now = Date.now();
    const { data } = await db()
      .from('allocations')
      .select('*,clients(full_name,email),games(team,opponent,game_date,start_time,venue,starts_at)')
      .order('requested_at');
    const rows = ((data ?? []) as any[])
      .filter((a) => {
        const future = new Date(a.games.starts_at).getTime() > now;
        if (team !== 'all' && a.games.team !== team) return false;
        if (status !== 'all' && a.status !== status) return false;
        if (when === 'upcoming' && !future) return false;
        if (when === 'past' && future) return false;
        if (q && !`${a.clients.full_name} ${a.clients.email} ${a.games.opponent} ${a.notes ?? ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .map((a) => ({
        client_name: a.clients.full_name,
        client_email: a.clients.email ?? '',
        team: teamName(a.games.team),
        opponent: a.games.opponent,
        game_date: a.games.game_date,
        start_time: a.games.start_time.slice(0, 5),
        venue: a.games.venue,
        tickets: a.quantity,
        type: a.source === 'admin' ? 'reserved' : 'claimed',
        reserved_by: a.reserved_by ?? '',
        status: a.status,
        source: a.source,
        requested_at: fmtStamp(a.requested_at),
        cancelled_at: fmtStamp(a.cancelled_at),
        notes: a.notes ?? '',
      }));
    return csvResponse(
      toCsv(rows, ['client_name', 'client_email', 'team', 'opponent', 'game_date', 'start_time', 'venue', 'tickets', 'type', 'reserved_by', 'status', 'requested_at', 'cancelled_at', 'notes']),
      `allocations-${stamp}.csv`,
    );
  }

  return NextResponse.json({ error: 'Unknown export.' }, { status: 404 });
}
