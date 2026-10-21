-- =====================================================================
-- Game reminders: records when each game's "3 days out" reminder was sent,
-- so a game is never reminded twice. Safe to run on a live database:
-- it only adds one empty column and changes no existing data.
-- =====================================================================
alter table public.games add column if not exists reminder_sent_at timestamptz;

-- Rebuild the availability view so it includes the new column.
drop view if exists public.game_availability;
create view public.game_availability
with (security_invoker = true) as
select
  g.*,
  coalesce(a.allocated, 0)::integer as allocated,
  greatest(g.total_inventory - coalesce(a.allocated, 0), 0)::integer as remaining
from public.games g
left join (
  select game_id, sum(quantity) as allocated
  from public.allocations
  where status = 'confirmed'
  group by game_id
) a on a.game_id = g.id;

revoke all on public.game_availability from anon, authenticated;
grant select on public.game_availability to service_role;
