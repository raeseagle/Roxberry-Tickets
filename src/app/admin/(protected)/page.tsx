import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { getAllGames } from '@/lib/games';
import { availabilityOf } from '@/lib/availability';
import { fmtGame, fmtStamp } from '@/lib/format';
import { AvailabilityBadge, Flash, PageHeader, TeamTag } from '@/components/admin/ui';
import AutoRefresh from '@/components/admin/AutoRefresh';

export default async function Overview({ searchParams }: { searchParams: { msg?: string; err?: string } }) {
  const games = await getAllGames();
  const now = Date.now();
  const upcoming = games.filter((g) => new Date(g.starts_at).getTime() > now);
  const live = upcoming.filter((g) => g.is_published);

  const stats = [
    { label: 'Upcoming games', value: upcoming.length, note: `${live.length} published` },
    { label: 'Available games', value: live.filter((g) => !g.is_closed && g.remaining > 0).length, note: 'Seats can be requested' },
    { label: 'Partially claimed', value: live.filter((g) => availabilityOf(g) === 'partial').length, note: 'Some seats taken' },
    { label: 'Sold out', value: upcoming.filter((g) => availabilityOf(g) === 'soldout').length, note: 'Every seat allocated' },
    { label: 'Tickets allocated', value: games.reduce((n, g) => n + g.allocated, 0), note: 'All season' },
    { label: 'Upcoming attendees', value: upcoming.reduce((n, g) => n + g.allocated, 0), note: 'Confirmed seats ahead' },
  ];

  const { data: recent } = await db()
    .from('allocations')
    .select('id,quantity,status,source,requested_at,clients(full_name,email),games(team,opponent,game_date,start_time)')
    .order('requested_at', { ascending: false })
    .limit(8);

  const { count: failed } = await db().from('email_logs').select('id', { count: 'exact', head: true }).eq('status', 'failed');

  return (
    <>
      <AutoRefresh />
      <PageHeader title="Overview" />
      <Flash searchParams={searchParams} />
      {!!failed && (
        <p className="mb-5 rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-3 text-sm text-red-100">
          {failed} {failed === 1 ? 'email has' : 'emails have'} failed to send.{' '}
          <Link href="/admin/emails?status=failed" className="font-semibold underline">
            Review and retry
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="text-xs font-semibold text-silver-400">{s.label}</p>
            <p className="mt-1 font-display text-4xl font-black text-white">{s.value}</p>
            <p className="text-xs text-silver-500">{s.note}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="panel overflow-x-auto p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-white">Recent allocations</h2>
            <Link href="/admin/allocations" className="text-xs text-silver-400 hover:text-white">
              See all
            </Link>
          </div>
          <table className="table mt-3">
            <tbody>
              {(recent ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/allocations/${a.id}`} className="font-semibold text-white hover:underline">
                      {a.clients?.full_name}
                    </Link>
                    <div className="text-xs text-silver-500">
                      {a.source === 'admin' ? 'Reserved' : 'Claimed'} {fmtStamp(a.requested_at)}
                    </div>
                  </td>
                  <td>
                    <TeamTag team={a.games?.team} /> <span className="text-silver-200">vs. {a.games?.opponent}</span>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {a.status === 'cancelled' ? <span className="text-silver-500 line-through">{a.quantity}</span> : a.quantity} seats
                  </td>
                </tr>
              ))}
              {!recent?.length && (
                <tr>
                  <td className="text-silver-400">No allocations yet. They appear here the moment a client claims seats.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="panel overflow-x-auto p-0">
          <div className="flex items-center justify-between px-5 pt-5">
            <h2 className="font-semibold text-white">Next up</h2>
            <Link href="/admin/calendar" className="text-xs text-silver-400 hover:text-white">
              Open calendar
            </Link>
          </div>
          <table className="table mt-3">
            <tbody>
              {upcoming.slice(0, 8).map((g) => (
                <tr key={g.id}>
                  <td>
                    <Link href={`/admin/games/${g.id}`} className="font-semibold text-white hover:underline">
                      vs. {g.opponent}
                    </Link>
                    <div className="text-xs text-silver-500">{fmtGame(g)}</div>
                  </td>
                  <td>
                    <TeamTag team={g.team} />
                    {!g.is_published && <div className="text-xs text-silver-500">Unpublished</div>}
                  </td>
                  <td className="text-right">
                    <div className="text-white">
                      {g.remaining}/{g.total_inventory} left
                    </div>
                    <AvailabilityBadge game={g} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
