import { db } from '@/lib/supabase/admin';
import { getAllGames } from '@/lib/games';
import { PageHeader } from '@/components/admin/ui';
import Calendar, { type CalGame } from '@/components/admin/Calendar';
import AutoRefresh from '@/components/admin/AutoRefresh';

export default async function CalendarPage() {
  const games = await getAllGames();
  const { data: allocs } = await db()
    .from('allocations')
    .select('id,game_id,quantity,source,notes,clients(full_name,email)')
    .eq('status', 'confirmed');

  const byGame = new Map<string, CalGame['allocations']>();
  for (const a of (allocs ?? []) as any[]) {
    const list = byGame.get(a.game_id) ?? [];
    list.push({ id: a.id, quantity: a.quantity, name: a.clients?.full_name ?? '', email: a.clients?.email ?? '', reserved: a.source === 'admin', note: a.notes ?? '' });
    byGame.set(a.game_id, list);
  }

  const data: CalGame[] = games.map((g) => ({
    id: g.id,
    team: g.team,
    opponent: g.opponent,
    game_date: g.game_date,
    start_time: g.start_time,
    venue: g.venue,
    total_inventory: g.total_inventory,
    allocated: g.allocated,
    remaining: g.remaining,
    is_closed: g.is_closed,
    is_published: g.is_published,
    allocations: byGame.get(g.id) ?? [],
  }));

  return (
    <>
      <AutoRefresh />
      <PageHeader title="Calendar" />
      <Calendar games={data} />
    </>
  );
}
