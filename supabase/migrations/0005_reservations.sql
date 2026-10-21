-- =====================================================================
-- Reservations made by administrators.
--  * Email becomes optional for people added in the dashboard (a reservation
--    can be just a name). Website requests still always require an email.
--  * Each reservation records which administrator made it.
-- Safe on a live database: changes no existing rows.
-- =====================================================================
alter table public.clients alter column email drop not null;
alter table public.allocations add column if not exists reserved_by text;

-- Existing dashboard-made allocations: fill in who made them from the activity log.
update public.allocations a
   set reserved_by = l.actor
  from public.audit_log l
 where a.source = 'admin' and a.reserved_by is null
   and l.entity_id = a.id and l.action = 'allocation.created';
