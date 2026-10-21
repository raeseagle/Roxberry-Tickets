import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase/admin';
import { fmtGame, fmtStamp } from '@/lib/format';
import { Back, Flash, StatusPill, TeamTag } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/buttons';
import AuditList from '@/components/admin/AuditList';
import { updateClientAction } from '../actions';

export default async function ClientDetail({ params, searchParams }: { params: { id: string }; searchParams: { msg?: string; err?: string } }) {
  const { data: c } = await db().from('clients').select('*').eq('id', params.id).maybeSingle();
  if (!c) notFound();
  const client = c as any;
  const [{ data: allocs }, { data: history }] = await Promise.all([
    db()
      .from('allocations')
      .select('id,quantity,status,requested_at,games(team,opponent,game_date,start_time,starts_at)')
      .eq('client_id', client.id)
      .order('requested_at', { ascending: false }),
    db().from('audit_log').select('*').eq('entity_id', client.id).order('occurred_at', { ascending: false }),
  ]);
  const now = Date.now();
  const list = ((allocs ?? []) as any[]).sort((a, b) => a.games.starts_at.localeCompare(b.games.starts_at));
  const upcoming = list.filter((a) => new Date(a.games.starts_at).getTime() > now);
  const past = list.filter((a) => new Date(a.games.starts_at).getTime() <= now).reverse();

  const Table = ({ rows, empty }: { rows: any[]; empty: string }) =>
    rows.length ? (
      <table className="table mt-2">
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <TeamTag team={a.games.team} />{' '}
                <Link href={`/admin/allocations/${a.id}`} className="text-white hover:underline">
                  vs. {a.games.opponent}
                </Link>
                <div className="text-xs text-silver-500">{fmtGame(a.games)}</div>
              </td>
              <td className="text-white">{a.quantity} seats</td>
              <td>
                <StatusPill status={a.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <p className="mt-2 text-sm text-silver-400">{empty}</p>
    );

  return (
    <>
      <Back href="/admin/clients" label="All clients" />
      <Flash searchParams={searchParams} />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <section className="panel">
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-white">{client.full_name}</h1>
            <p className="mt-1 text-silver-300">{client.email ?? 'No email on file'}</p>
            <p className="mt-1 text-xs text-silver-500">Client since {fmtStamp(client.created_at)}</p>
          </section>
          <section className="panel">
            <h2 className="font-semibold text-white">Upcoming</h2>
            <Table rows={upcoming} empty="No upcoming games." />
          </section>
          <section className="panel">
            <h2 className="font-semibold text-white">Past</h2>
            <Table rows={past} empty="No past games yet." />
          </section>
          <section className="panel">
            <h2 className="font-semibold text-white">History</h2>
            <AuditList entries={(history ?? []) as any[]} />
          </section>
        </div>
        <section className="panel h-fit">
          <h2 className="font-semibold text-white">Edit client</h2>
          <form action={updateClientAction} className="mt-3 space-y-3">
            <input type="hidden" name="id" value={client.id} />
            <div>
              <label className="label" htmlFor="n">
                Full name
              </label>
              <input id="n" name="full_name" defaultValue={client.full_name} className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="e">
                Email
              </label>
              <input id="e" name="email" type="email" defaultValue={client.email ?? ''} className="field" placeholder="Optional" />
            </div>
            <div>
              <label className="label" htmlFor="no">
                Internal notes
              </label>
              <textarea id="no" name="notes" rows={4} defaultValue={client.notes ?? ''} className="field" />
            </div>
            <label className="flex items-center gap-2 text-sm text-silver-300">
              <input type="checkbox" name="is_active" defaultChecked={client.is_active} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm text-silver-300">
              <input type="checkbox" name="is_archived" defaultChecked={client.is_archived} /> Archived (hidden from lists and pickers)
            </label>
            <SubmitButton>Save client</SubmitButton>
          </form>
        </section>
      </div>
    </>
  );
}
