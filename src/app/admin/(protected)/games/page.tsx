import Link from 'next/link';
import { getAllGames } from '@/lib/games';
import { fmtGame } from '@/lib/format';
import { AvailabilityBadge, Flash, PageHeader, TeamTag } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/buttons';
import { importGames, setPublished } from './actions';

type SP = { team?: string; when?: string; pub?: string; msg?: string; err?: string };

export default async function GamesPage({ searchParams }: { searchParams: SP }) {
  const games = await getAllGames();
  const team = searchParams.team ?? 'all';
  const when = searchParams.when ?? 'upcoming';
  const pub = searchParams.pub ?? 'all';
  const now = Date.now();
  const rows = games.filter((g) => {
    const future = new Date(g.starts_at).getTime() > now;
    if (team !== 'all' && g.team !== team) return false;
    if (when === 'upcoming' && !future) return false;
    if (when === 'past' && future) return false;
    if (pub === 'published' && !g.is_published) return false;
    if (pub === 'draft' && g.is_published) return false;
    return true;
  });
  const here = `/admin/games?${new URLSearchParams({ team, when, pub }).toString()}`;

  return (
    <>
      <PageHeader title="Games">
        <a href="/api/admin/export/games" className="btn-ghost">
          Export schedule
        </a>
        <Link href="/admin/games/new" className="btn-primary">
          Add game
        </Link>
      </PageHeader>
      <Flash searchParams={searchParams} />

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div>
          <form method="get" className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
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
              <label className="label" htmlFor="when">
                Dates
              </label>
              <select id="when" name="when" defaultValue={when} className="field">
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
                <option value="all">All</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pub">
                Visibility
              </label>
              <select id="pub" name="pub" defaultValue={pub} className="field">
                <option value="all">All</option>
                <option value="published">Published</option>
                <option value="draft">Unpublished</option>
              </select>
            </div>
            <button className="btn-primary">Apply</button>
          </form>

          <div className="panel overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Team</th>
                  <th>Seats</th>
                  <th>Status</th>
                  <th>Public site</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link href={`/admin/games/${g.id}`} className="font-semibold text-white hover:underline">
                        vs. {g.opponent}
                      </Link>
                      <div className="text-xs text-silver-500">
                        {fmtGame(g)} · {g.venue}
                      </div>
                    </td>
                    <td>
                      <TeamTag team={g.team} />
                    </td>
                    <td className="whitespace-nowrap text-silver-200">
                      {g.allocated} taken / {g.total_inventory}
                    </td>
                    <td>
                      <AvailabilityBadge game={g} />
                    </td>
                    <td>
                      <form action={setPublished} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={g.id} />
                        <input type="hidden" name="published" value={String(!g.is_published)} />
                        <input type="hidden" name="return_to" value={here} />
                        <span className={`text-xs ${g.is_published ? 'text-emerald-200' : 'text-silver-500'}`}>{g.is_published ? 'Published' : 'Hidden'}</span>
                        <SubmitButton className="btn-ghost px-2 py-0.5 text-xs" pendingText="…">
                          {g.is_published ? 'Unpublish' : 'Publish'}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-silver-400">
                      No games match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="panel h-fit">
          <h2 className="font-semibold text-white">Import schedule from CSV</h2>
          <p className="mt-1 text-xs leading-relaxed text-silver-400">
            Columns: <code>team, opponent, date, time, venue, inventory, published</code>. Team is <code>jazz</code> or <code>mammoth</code>; date as
            2027-01-15 or 1/15/2027; time as 19:00 or 7:00 PM (Salt Lake City time). Games already on the schedule (same team and date) are skipped.
          </p>
          <form action={importGames} className="mt-3 space-y-3">
            <input name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm text-silver-300" required />
            <SubmitButton className="btn-ghost" pendingText="Importing…">
              Import games
            </SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
