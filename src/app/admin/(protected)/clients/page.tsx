import Link from 'next/link';
import { db } from '@/lib/supabase/admin';
import { Flash, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/admin/buttons';
import { createClientAction, importClients } from './actions';

type SP = { q?: string; status?: string; msg?: string; err?: string };

export default async function ClientsPage({ searchParams }: { searchParams: SP }) {
  const [{ data: clients }, { data: allocs }] = await Promise.all([
    db().from('clients').select('*').order('full_name'),
    db().from('allocations').select('client_id,quantity,games(starts_at)').eq('status', 'confirmed'),
  ]);
  const now = Date.now();
  const stats = new Map<string, { total: number; upcoming: number }>();
  for (const a of (allocs ?? []) as any[]) {
    const s = stats.get(a.client_id) ?? { total: 0, upcoming: 0 };
    s.total += a.quantity;
    if (new Date(a.games?.starts_at).getTime() > now) s.upcoming += a.quantity;
    stats.set(a.client_id, s);
  }

  const q = (searchParams.q ?? '').trim().toLowerCase();
  const status = searchParams.status ?? 'active';
  const rows = ((clients ?? []) as any[]).filter((c) => {
    if (status === 'active' && (!c.is_active || c.is_archived)) return false;
    if (status === 'inactive' && (c.is_active || c.is_archived)) return false;
    if (status === 'archived' && !c.is_archived) return false;
    if (q && !`${c.full_name} ${c.email} ${c.notes ?? ''}`.toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <>
      <PageHeader title="Clients">
        <a href="/api/admin/export/clients" className="btn-ghost">
          Export CSV
        </a>
      </PageHeader>
      <Flash searchParams={searchParams} />

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div>
          <form method="get" className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[14rem] flex-1">
              <label className="label" htmlFor="q">
                Search
              </label>
              <input id="q" name="q" defaultValue={searchParams.q} placeholder="Name, email, or note" className="field" />
            </div>
            <div>
              <label className="label" htmlFor="status">
                Show
              </label>
              <select id="status" name="status" defaultValue={status} className="field">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
                <option value="all">Everyone</option>
              </select>
            </div>
            <button className="btn-primary">Apply</button>
          </form>

          <div className="panel overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Upcoming seats</th>
                  <th>Season seats</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/clients/${c.id}`} className="font-semibold text-white hover:underline">
                        {c.full_name}
                      </Link>
                    </td>
                    <td className="text-silver-300">{c.email ?? <span className="text-silver-500">—</span>}</td>
                    <td className="text-white">{stats.get(c.id)?.upcoming ?? 0}</td>
                    <td className="text-silver-300">{stats.get(c.id)?.total ?? 0}</td>
                    <td className="text-xs text-silver-400">{c.is_archived ? 'Archived' : c.is_active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-silver-400">
                      No clients match. Clients are added automatically when they claim tickets, or you can add them here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <section className="panel">
            <h2 className="font-semibold text-white">Add a client</h2>
            <form action={createClientAction} className="mt-3 space-y-3">
              <input name="full_name" placeholder="Full name" className="field" required />
              <input name="email" type="email" placeholder="Email (optional)" className="field" />
              <textarea name="notes" placeholder="Internal notes (optional)" rows={2} className="field" />
              <SubmitButton>Add client</SubmitButton>
            </form>
          </section>
          <section className="panel">
            <h2 className="font-semibold text-white">Import from CSV</h2>
            <p className="mt-1 text-xs leading-relaxed text-silver-400">
              Columns: <code>full_name, email, notes, active</code>. Existing emails are skipped, never overwritten.
            </p>
            <form action={importClients} className="mt-3 space-y-3">
              <input name="file" type="file" accept=".csv,text/csv" className="block w-full text-sm text-silver-300" required />
              <SubmitButton className="btn-ghost" pendingText="Importing…">
                Import clients
              </SubmitButton>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
