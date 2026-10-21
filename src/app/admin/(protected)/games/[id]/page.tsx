import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { fmtGame, fmtStamp } from '@/lib/format';
import { teamName } from '@/lib/teams';
import { AvailabilityBadge, Back, Flash, KindTag } from '@/components/admin/ui';
import { ConfirmButton, SubmitButton } from '@/components/admin/buttons';
import GameForm from '@/components/admin/GameForm';
import AuditList from '@/components/admin/AuditList';
import { addAllocation, deleteGame, sendReminderNow, setClosed, updateGame } from '../actions';
import type { Game } from '@/lib/types';

export default async function GameDetail({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string; err?: string; t?: string } }) {
  const { data } = await db().from('game_availability').select('*').eq('id', params.id).maybeSingle();
  if (!data) notFound();
  const g = data as Game;
  const [{ data: allocs }, { data: clients }, { data: history }] = await Promise.all([
    db().from('allocations').select('id,quantity,status,requested_at,source,reserved_by,notes,clients(full_name,email)').eq('game_id', g.id).order('requested_at'),
    db().from('clients').select('id,full_name,email').eq('is_archived', false).order('full_name'),
    db().from('audit_log').select('*').eq('entity_id', g.id).order('occurred_at', { ascending: false }),
  ]);
  const list = (allocs ?? []) as any[];

  return (
    <>
      <Back href="/admin/games" label="All games" />
      <Flash searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="panel" data-team={g.team}>
            <p className="text-sm font-semibold" style={{ color: 'var(--team-accent)' }}>
              {teamName(g.team)} vs.
            </p>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-white">{g.opponent}</h1>
            <p className="mt-2 text-silver-300">
              {fmtGame(g)} · {g.venue}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <AvailabilityBadge game={g} />
              <span className="text-sm text-silver-300">
                {g.allocated} allocated · {g.remaining} remaining · {g.total_inventory} total
              </span>
              {!g.is_published && <span className="text-xs text-silver-500">Not on the public site</span>}
            </div>
            {g.is_closed && g.remaining > 0 && (
              <p className="mt-3 text-sm text-amber-200">
                Closed by an administrator — {g.remaining} {g.remaining === 1 ? 'seat is' : 'seats are'} unclaimed but no one can request them until you reopen.
              </p>
            )}
          </section>

          <section className="panel overflow-x-auto">
            <h2 className="font-semibold text-white">Allocations</h2>
            {list.length ? (
              <table className="table mt-2">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Tickets</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/allocations/${a.id}`} className="font-semibold text-white hover:underline">
                          {a.clients.full_name}
                        </Link>
                        <div className="text-xs text-silver-400">{a.clients.email ?? 'No email'}</div>
                      </td>
                      <td className="text-white">{a.quantity}</td>
                      <td>
                        <KindTag source={a.source} status={a.status} />
                        {a.notes && <div className="mt-1 max-w-[14rem] text-xs text-silver-400">{a.notes}</div>}
                      </td>
                      <td className="text-xs text-silver-400">
                        {fmtStamp(a.requested_at)}
                        <div>{a.source === 'admin' ? `Reserved by ${a.reserved_by ?? 'an admin'}` : 'Claimed on website'}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-silver-400">No one has claimed seats for this game yet.</p>
            )}
          </section>

          <section className="panel">
            <h2 className="mb-4 font-semibold text-white">Edit game</h2>
            <GameForm action={updateGame} defaults={g} submitLabel="Save game" minInventory={g.allocated} />
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">History</h2>
            <AuditList entries={(history ?? []) as any[]} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="font-semibold text-white">Reserve seats</h2>
            <p className="mt-1 text-xs text-silver-400">Holds seats for someone without emailing anyone. Reserved seats come off the public availability.</p>
            {g.remaining > 0 ? (
              <form key={searchParams.t ?? 'reserve'} action={addAllocation} className="mt-3 space-y-3">
                <input type="hidden" name="game_id" value={g.id} />
                <div>
                  <label className="label" htmlFor="res-qty">
                    Seats
                  </label>
                  <select id="res-qty" name="quantity" className="field">
                    {Array.from({ length: Math.min(g.remaining, 50) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'seat' : 'seats'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="res-name">
                    Reserved for
                  </label>
                  <input id="res-name" name="new_name" placeholder="Name, e.g. Mark Johnson" className="field" />
                  <input name="new_email" type="email" placeholder="Their email (optional)" className="field mt-2" />
                </div>
                <div>
                  <label className="label" htmlFor="res-client">
                    …or pick someone already in the client list
                  </label>
                  <select id="res-client" name="client_id" className="field" defaultValue="">
                    <option value="">—</option>
                    {((clients ?? []) as any[]).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                        {c.email ? ` (${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="res-note">
                    Note (optional)
                  </label>
                  <input id="res-note" name="note" placeholder="e.g. Store manager, sold for $200" className="field" />
                </div>
                <SubmitButton className="btn-primary">Reserve seats</SubmitButton>
              </form>
            ) : (
              <p className="mt-2 text-sm text-silver-400">No seats remain. Raise the inventory or cancel an allocation first.</p>
            )}
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">Game reminder</h2>
            <p className="mt-1 text-xs text-silver-400">
              {g.reminder_sent_at
                ? `Sent ${fmtStamp(g.reminder_sent_at)} MT.`
                : 'Sent automatically a few days before the game, listing who has seats and how many are unclaimed.'}
            </p>
            <form action={sendReminderNow} className="mt-3">
              <input type="hidden" name="id" value={g.id} />
              <SubmitButton className="btn-ghost" pendingText="Sending…">
                {g.reminder_sent_at ? 'Send it again' : 'Send reminder now'}
              </SubmitButton>
            </form>
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">{g.is_closed ? 'Reopen requests' : 'Close requests'}</h2>
            <p className="mt-1 text-xs text-silver-400">
              {g.is_closed
                ? 'Clients will be able to request any remaining seats again.'
                : 'Stops new requests even if seats remain. Cancelling an allocation will not reopen it.'}
            </p>
            <form action={setClosed} className="mt-3">
              <input type="hidden" name="id" value={g.id} />
              <input type="hidden" name="closed" value={String(!g.is_closed)} />
              <SubmitButton className="btn-ghost">{g.is_closed ? 'Reopen game' : 'Close game'}</SubmitButton>
            </form>
          </section>

          {!g.is_published && list.length === 0 && (
            <section className="panel border-red-500/30">
              <h2 className="font-semibold text-white">Delete game</h2>
              <p className="mt-1 text-xs text-silver-400">Only unpublished games with no allocations can be deleted.</p>
              <form action={deleteGame} className="mt-3">
                <input type="hidden" name="id" value={g.id} />
                <ConfirmButton message="Delete this game permanently?">Delete game</ConfirmButton>
              </form>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
