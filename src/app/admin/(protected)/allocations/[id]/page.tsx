import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { fmtGame, fmtStamp } from '@/lib/format';
import { teamName } from '@/lib/teams';
import { Back, Flash, KindTag, TeamTag } from '@/components/admin/ui';
import { ConfirmButton, SubmitButton } from '@/components/admin/buttons';
import EmailLogTable from '@/components/admin/EmailLogTable';
import AuditList from '@/components/admin/AuditList';
import { cancelAllocation, changeQuantity, reassignAllocation, saveAllocationNotes } from '../actions';
import { updateClientContact } from '../../clients/actions';

export default async function AllocationDetail({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string; err?: string } }) {
  const { data: a } = await db()
    .from('allocations')
    .select('*,clients(id,full_name,email,is_active),games(id,team,opponent,game_date,start_time,venue)')
    .eq('id', params.id)
    .maybeSingle();
  if (!a) notFound();
  const alloc = a as any;

  const [{ data: avail }, { data: emails }, { data: history }, { data: clients }] = await Promise.all([
    db().from('game_availability').select('remaining,total_inventory,allocated,is_closed').eq('id', alloc.game_id).single(),
    db().from('email_logs').select('*').eq('allocation_id', alloc.id).order('created_at', { ascending: false }),
    db().from('audit_log').select('*').eq('entity_id', alloc.id).order('occurred_at', { ascending: false }),
    db().from('clients').select('id,full_name,email').eq('is_archived', false).order('full_name'),
  ]);
  const g = avail as any;
  const active = alloc.status === 'confirmed';
  const maxQty = Math.min(50, alloc.quantity + (g?.remaining ?? 0));
  const here = `/admin/allocations/${alloc.id}`;

  return (
    <>
      <Back href="/admin/allocations" label="All allocations" />
      <Flash searchParams={searchParams} />

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-silver-400">Allocation</p>
                <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-white">{alloc.clients.full_name}</h1>
                <p className="mt-1 text-silver-300">{alloc.clients.email ?? 'No email on file'}</p>
              </div>
              <KindTag source={alloc.source} status={alloc.status} />
            </div>
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-silver-500">Game</dt>
                <dd className="text-white">
                  <TeamTag team={alloc.games.team} />{' '}
                  <Link className="hover:underline" href={`/admin/games/${alloc.games.id}`}>
                    {teamName(alloc.games.team)} vs. {alloc.games.opponent}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-silver-500">When</dt>
                <dd className="text-white">{fmtGame(alloc.games)}</dd>
              </div>
              <div>
                <dt className="text-silver-500">Tickets</dt>
                <dd className="font-display text-3xl font-black text-white">{alloc.quantity}</dd>
              </div>
              <div>
                <dt className="text-silver-500">Game seats left</dt>
                <dd className="text-white">
                  {g?.remaining} of {g?.total_inventory}
                  {g?.is_closed && <span className="ml-2 text-amber-200">(game closed)</span>}
                </dd>
              </div>
              <div>
                <dt className="text-silver-500">{alloc.source === 'admin' ? 'Reserved' : 'Claimed'}</dt>
                <dd className="text-white">
                  {fmtStamp(alloc.requested_at)} MT{' '}
                  <span className="text-silver-500">
                    {alloc.source === 'admin' ? `by ${alloc.reserved_by ?? 'an admin'} in the dashboard` : 'on the website'}
                  </span>
                </dd>
              </div>
              {alloc.cancelled_at && (
                <div>
                  <dt className="text-silver-500">Cancelled</dt>
                  <dd className="text-white">{fmtStamp(alloc.cancelled_at)} MT</dd>
                </div>
              )}
            </dl>
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">Internal notes</h2>
            <form action={saveAllocationNotes} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={alloc.id} />
              <textarea name="notes" rows={3} defaultValue={alloc.notes ?? ''} className="field" placeholder="Only administrators see these notes." />
              <SubmitButton>Save notes</SubmitButton>
            </form>
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">Emails</h2>
            <EmailLogTable logs={(emails ?? []) as any[]} returnTo={here} compact />
          </section>

          <section className="panel">
            <h2 className="font-semibold text-white">History</h2>
            <AuditList entries={(history ?? []) as any[]} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="font-semibold text-white">Correct contact info</h2>
            <p className="mt-1 text-xs text-silver-400">Updates the client record, so it applies to all of their allocations.</p>
            <form action={updateClientContact} className="mt-3 space-y-3">
              <input type="hidden" name="id" value={alloc.clients.id} />
              <input type="hidden" name="return_to" value={here} />
              <div>
                <label className="label" htmlFor="cn">
                  Full name
                </label>
                <input id="cn" name="full_name" defaultValue={alloc.clients.full_name} className="field" required />
              </div>
              <div>
                <label className="label" htmlFor="ce">
                  Email
                </label>
                <input id="ce" name="email" type="email" defaultValue={alloc.clients.email ?? ''} className="field" placeholder="Optional" />
              </div>
              <SubmitButton className="btn-ghost">Save contact info</SubmitButton>
            </form>
          </section>

          {active && (
            <>
              <section className="panel">
                <h2 className="font-semibold text-white">Change ticket count</h2>
                <form action={changeQuantity} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={alloc.id} />
                  <select name="quantity" defaultValue={alloc.quantity} className="field" aria-label="Number of tickets">
                    {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'ticket' : 'tickets'}
                      </option>
                    ))}
                  </select>
                  <SubmitButton className="btn-ghost">Update ticket count</SubmitButton>
                </form>
              </section>

              <section className="panel">
                <h2 className="font-semibold text-white">Reassign to another client</h2>
                <form action={reassignAllocation} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={alloc.id} />
                  <div>
                    <label className="label" htmlFor="rc">
                      Existing client
                    </label>
                    <select id="rc" name="client_id" className="field" defaultValue="">
                      <option value="">Choose a client…</option>
                      {((clients ?? []) as any[])
                        .filter((c) => c.id !== alloc.client_id)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name}
                            {c.email ? ` (${c.email})` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                  <p className="text-xs text-silver-500">Or add someone new:</p>
                  <input name="new_name" placeholder="New client's full name" className="field" />
                  <input name="new_email" type="email" placeholder="New client's email (optional)" className="field" />
                  <SubmitButton className="btn-ghost">Reassign tickets</SubmitButton>
                </form>
              </section>

              <section className="panel border-red-500/30">
                <h2 className="font-semibold text-white">Cancel allocation</h2>
                <p className="mt-1 text-xs text-silver-400">
                  Returns {alloc.quantity} {alloc.quantity === 1 ? 'seat' : 'seats'} to the game. A closed game stays closed.
                </p>
                <form action={cancelAllocation} className="mt-3 space-y-3">
                  <input type="hidden" name="id" value={alloc.id} />
                  <input name="reason" placeholder="Reason (internal, optional)" className="field" />
                  <ConfirmButton message="Cancel this allocation and return the seats to inventory?">Cancel allocation</ConfirmButton>
                </form>
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
