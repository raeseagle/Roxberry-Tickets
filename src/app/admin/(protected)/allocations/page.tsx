import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { fmtGame, fmtStamp } from '@/lib/format';
import { Flash, KindTag, PageHeader, TeamTag } from '@/components/admin/ui';
import AutoRefresh from '@/components/admin/AutoRefresh';
import type { AllocationRow } from '@/lib/types';

type SP = { q?: string; team?: string; status?: string; when?: string; msg?: string; err?: string };

export default async function AllocationsPage({ searchParams }: { searchParams: SP }) {
  const { data } = await db()
    .from('allocations')
    .select('*,clients(id,full_name,email),games(id,team,opponent,game_date,start_time,venue,is_closed,starts_at)')
    .order('requested_at', { ascending: false });

  const q = (searchParams.q ?? '').trim().toLowerCase();
  const team = searchParams.team ?? 'all';
  const status = searchParams.status ?? 'confirmed';
  const when = searchParams.when ?? 'upcoming';
  const now = Date.now();

  const rows = ((data ?? []) as (AllocationRow & { games: { starts_at: string } })[]).filter((a) => {
    if (team !== 'all' && a.games.team !== team) return false;
    if (status === 'reserved' && !(a.status === 'confirmed' && a.source === 'admin')) return false;
    if (status === 'claimed' && !(a.status === 'confirmed' && a.source === 'public')) return false;
    if ((status === 'confirmed' || status === 'cancelled') && a.status !== status) return false;
    const future = new Date(a.games.starts_at).getTime() > now;
    if (when === 'upcoming' && !future) return false;
    if (when === 'past' && future) return false;
    if (q) {
      const hay = `${a.clients.full_name} ${a.clients.email ?? ''} ${a.games.opponent} ${a.notes ?? ''} ${a.reserved_by ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const exportHref = `/api/admin/export/allocations?${new URLSearchParams({ q, team, status, when }).toString()}`;

  return (
    <>
      <AutoRefresh />
      <PageHeader title="Allocations">
        <a href={exportHref} className="btn-ghost">
          Export CSV
        </a>
      </PageHeader>
      <Flash searchParams={searchParams} />

      <form className="panel mb-4 flex flex-wrap items-end gap-3 p-4" method="get">
        <div className="min-w-[14rem] flex-1">
          <label className="label" htmlFor="q">
            Search
          </label>
          <input id="q" name="q" defaultValue={searchParams.q} placeholder="Name, email, opponent, or note" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="team">
            Team
          </label>
          <select id="team" name="team" defaultValue={team} className="field">
            <option value="all">Both</option>
            <option value="jazz">Jazz</option>
            <option value="mammoth">Mammoth</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="status">
            Status
          </label>
          <select id="status" name="status" defaultValue={status} className="field">
            <option value="confirmed">Active (claimed + reserved)</option>
            <option value="claimed">Claimed on website</option>
            <option value="reserved">Reserved by admin</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="when">
            Games
          </label>
          <select id="when" name="when" defaultValue={when} className="field">
            <option value="upcoming">Upcoming</option>
            <option value="past">Past</option>
            <option value="all">All</option>
          </select>
        </div>
        <button className="btn-primary">Apply</button>
      </form>

      <div className="panel overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr>
              <th>Client name</th>
              <th>Client email</th>
              <th>Team</th>
              <th>Opponent</th>
              <th>Game date and time</th>
              <th>Tickets</th>
              <th>Status</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/admin/allocations/${a.id}`} className="font-semibold text-white hover:underline">
                    {a.clients.full_name}
                  </Link>
                </td>
                <td className="text-silver-300">{a.clients.email ?? <span className="text-silver-500">—</span>}</td>
                <td>
                  <TeamTag team={a.games.team} />
                </td>
                <td className="text-silver-100">{a.games.opponent}</td>
                <td className="whitespace-nowrap text-silver-300">{fmtGame(a.games)}</td>
                <td className="text-white">{a.quantity}</td>
                <td>
                  <KindTag source={a.source} status={a.status} />
                  {a.source === 'admin' && a.reserved_by && <div className="text-xs text-silver-500">by {a.reserved_by}</div>}
                </td>
                <td className="whitespace-nowrap text-xs text-silver-400">{fmtStamp(a.requested_at)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="py-8 text-center text-silver-400">
                  No allocations match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-silver-500">
        {rows.length} {rows.length === 1 ? 'allocation' : 'allocations'} · {rows.reduce((n, a) => n + (a.status === 'confirmed' ? a.quantity : 0), 0)} confirmed seats
      </p>
    </>
  );
}
