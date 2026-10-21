-- =====================================================================
-- Milly Research — Season Ticket Giveaway
-- Schema, integrity guards, transaction-safe allocation functions, RLS.
-- Run this once in the Supabase SQL Editor, then run 0002_seed.sql.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Settings (single JSON document under key 'app')
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Administrators
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique check (email = lower(btrim(email)) and email like '%_@_%._%'),
  role           text not null default 'admin' check (role in ('owner', 'admin')),
  auth_provider  text not null default 'email_magic_link',
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Games
-- game_date + start_time are the local (Salt Lake City) values shown to people.
-- starts_at is the exact instant, kept in sync by trigger.
-- ---------------------------------------------------------------------
create table if not exists public.games (
  id               uuid primary key default gen_random_uuid(),
  team             text not null check (team in ('jazz', 'mammoth')),
  opponent         text not null check (length(btrim(opponent)) > 0),
  game_date        date not null,
  start_time       time not null,
  timezone         text not null default 'America/Denver',
  starts_at        timestamptz not null,
  venue            text not null default 'Delta Center',
  total_inventory  integer not null default 4 check (total_inventory between 0 and 50),
  is_published     boolean not null default false,
  is_closed        boolean not null default false,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (team, game_date)
);
create index if not exists games_starts_at_idx on public.games (starts_at);

-- ---------------------------------------------------------------------
-- Clients (email is stored normalized: trimmed + lowercase, unique)
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (length(btrim(full_name)) > 0),
  email        text not null unique check (email = lower(btrim(email)) and email like '%_@_%._%'),
  is_active    boolean not null default true,
  is_archived  boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Allocations
-- ---------------------------------------------------------------------
create table if not exists public.allocations (
  id               uuid primary key default gen_random_uuid(),
  game_id          uuid not null references public.games (id) on delete restrict,
  client_id        uuid not null references public.clients (id) on delete restrict,
  quantity         integer not null check (quantity between 1 and 50),
  status           text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  source           text not null default 'public' check (source in ('public', 'admin')),
  idempotency_key  text unique,
  requested_at     timestamptz not null default now(),
  cancelled_at     timestamptz,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check ((status = 'cancelled') = (cancelled_at is not null))
);
create index if not exists allocations_game_idx on public.allocations (game_id) where status = 'confirmed';
create index if not exists allocations_client_idx on public.allocations (client_id);

-- ---------------------------------------------------------------------
-- Email logs
-- ---------------------------------------------------------------------
create table if not exists public.email_logs (
  id                   uuid primary key default gen_random_uuid(),
  allocation_id        uuid references public.allocations (id) on delete set null,
  recipient            text not null,
  notification_type    text not null,
  status               text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  subject              text,
  context              jsonb not null default '{}'::jsonb,
  attempts             integer not null default 0,
  attempted_at         timestamptz,
  provider_message_id  text,
  error                text,
  created_at           timestamptz not null default now()
);
create index if not exists email_logs_status_idx on public.email_logs (status);
create index if not exists email_logs_alloc_idx on public.email_logs (allocation_id);

-- ---------------------------------------------------------------------
-- Audit history
-- ---------------------------------------------------------------------
create table if not exists public.audit_log (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  actor        text not null,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  details      jsonb not null default '{}'::jsonb
);
create index if not exists audit_entity_idx on public.audit_log (entity_type, entity_id);
create index if not exists audit_time_idx on public.audit_log (occurred_at desc);

-- ---------------------------------------------------------------------
-- Rate limiting buckets
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  count         integer not null default 0,
  primary key (key, window_start)
);

-- =====================================================================
-- Triggers
-- =====================================================================

-- Keep games.starts_at in sync with local date/time/timezone.
create or replace function public.games_before_write() returns trigger
language plpgsql as $$
begin
  new.starts_at := (new.game_date + new.start_time) at time zone new.timezone;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists games_before_write on public.games;
create trigger games_before_write before insert or update on public.games
for each row execute function public.games_before_write();

-- Never let inventory drop below what is already allocated.
create or replace function public.games_inventory_guard() returns trigger
language plpgsql as $$
declare v_allocated integer;
begin
  if new.total_inventory is distinct from old.total_inventory then
    select coalesce(sum(quantity), 0) into v_allocated
      from public.allocations where game_id = new.id and status = 'confirmed';
    if new.total_inventory < v_allocated then
      raise exception 'INVENTORY_BELOW_ALLOCATED: % allocated, % requested', v_allocated, new.total_inventory
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists games_inventory_guard on public.games;
create trigger games_inventory_guard before update on public.games
for each row execute function public.games_inventory_guard();

-- Final safety net: no write to allocations can ever exceed a game's inventory.
-- Locks the game row so concurrent writers are serialized.
create or replace function public.allocations_guard() returns trigger
language plpgsql as $$
declare v_inventory integer; v_others integer;
begin
  new.updated_at := now();
  if new.status <> 'confirmed' then
    return new;
  end if;
  select total_inventory into v_inventory from public.games where id = new.game_id for update;
  select coalesce(sum(quantity), 0) into v_others
    from public.allocations
   where game_id = new.game_id and status = 'confirmed' and id <> new.id;
  if v_others + new.quantity > v_inventory then
    raise exception 'OVER_ALLOCATION' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists allocations_guard on public.allocations;
create trigger allocations_guard before insert or update on public.allocations
for each row execute function public.allocations_guard();

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
for each row execute function public.touch_updated_at();

drop trigger if exists admins_touch on public.admins;
create trigger admins_touch before update on public.admins
for each row execute function public.touch_updated_at();

-- =====================================================================
-- Availability view (remaining is always computed, so it can never drift)
-- =====================================================================
create or replace view public.game_availability
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

-- =====================================================================
-- Allocation functions (each call runs as a single transaction)
-- =====================================================================

-- Core allocation. Used by the public request form and by admins.
create or replace function public.allocate_tickets(
  p_game_id          uuid,
  p_full_name        text,
  p_email            text,
  p_quantity         integer,
  p_idempotency_key  text default null,
  p_source           text default 'public',
  p_actor            text default 'public',
  p_client_id        uuid default null
) returns jsonb
language plpgsql as $$
declare
  v_game       public.games%rowtype;
  v_alloc      public.allocations%rowtype;
  v_allocated  integer;
  v_client     uuid;
  v_email      text := lower(btrim(coalesce(p_email, '')));
  v_name       text := btrim(coalesce(p_full_name, ''));
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_quantity');
  end if;
  if p_source = 'public' and p_quantity > 4 then
    return jsonb_build_object('ok', false, 'code', 'invalid_quantity');
  end if;

  -- Lock the game row. Every allocation for this game queues behind this lock.
  select * into v_game from public.games where id = p_game_id for update;
  if not found or (p_source = 'public' and not v_game.is_published) then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_game.is_closed and p_source = 'public' then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if p_source = 'public' and v_game.starts_at <= now() then
    return jsonb_build_object('ok', false, 'code', 'past');
  end if;

  -- Idempotency: checked after the lock so simultaneous duplicates are serialized.
  if p_idempotency_key is not null then
    select * into v_alloc from public.allocations where idempotency_key = p_idempotency_key;
    if found then
      select coalesce(sum(quantity), 0) into v_allocated
        from public.allocations where game_id = p_game_id and status = 'confirmed';
      return jsonb_build_object('ok', v_alloc.status = 'confirmed', 'duplicate', true,
        'allocation_id', v_alloc.id, 'quantity', v_alloc.quantity,
        'remaining', greatest(v_game.total_inventory - v_allocated, 0),
        'code', case when v_alloc.status = 'confirmed' then null else 'cancelled' end);
    end if;
  end if;

  -- Resolve client (match on normalized email).
  if p_client_id is not null then
    select id into v_client from public.clients where id = p_client_id;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'client_not_found');
    end if;
  else
    if length(v_name) = 0 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      return jsonb_build_object('ok', false, 'code', 'invalid_contact');
    end if;
    insert into public.clients (full_name, email)
    values (left(v_name, 200), left(v_email, 320))
    on conflict (email) do update set updated_at = now()
    returning id into v_client;
  end if;

  -- Guard against resubmits (refresh, back button) from the same person.
  if p_source = 'public' then
    select * into v_alloc from public.allocations
     where game_id = p_game_id and client_id = v_client and quantity = p_quantity
       and status = 'confirmed' and requested_at > now() - interval '2 minutes'
     order by requested_at desc limit 1;
    if found then
      select coalesce(sum(quantity), 0) into v_allocated
        from public.allocations where game_id = p_game_id and status = 'confirmed';
      return jsonb_build_object('ok', true, 'duplicate', true, 'allocation_id', v_alloc.id,
        'quantity', v_alloc.quantity, 'remaining', greatest(v_game.total_inventory - v_allocated, 0));
    end if;
  end if;

  select coalesce(sum(quantity), 0) into v_allocated
    from public.allocations where game_id = p_game_id and status = 'confirmed';

  if v_allocated + p_quantity > v_game.total_inventory then
    return jsonb_build_object('ok', false, 'code', 'insufficient',
      'remaining', greatest(v_game.total_inventory - v_allocated, 0));
  end if;

  insert into public.allocations (game_id, client_id, quantity, source, idempotency_key)
  values (p_game_id, v_client, p_quantity, p_source, p_idempotency_key)
  returning * into v_alloc;

  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (coalesce(p_actor, 'public'), 'allocation.created', 'allocation', v_alloc.id,
    jsonb_build_object('game_id', p_game_id, 'client_id', v_client, 'quantity', p_quantity,
      'source', p_source, 'remaining_after', v_game.total_inventory - v_allocated - p_quantity));

  return jsonb_build_object('ok', true, 'duplicate', false, 'allocation_id', v_alloc.id,
    'quantity', p_quantity, 'remaining', v_game.total_inventory - v_allocated - p_quantity);
end $$;

-- Cancel an allocation. Seats return to inventory automatically (remaining is computed).
-- A manually closed game stays closed.
create or replace function public.admin_cancel_allocation(p_allocation_id uuid, p_actor text, p_reason text default null)
returns jsonb language plpgsql as $$
declare v_game_id uuid; v_alloc public.allocations%rowtype; v_closed boolean;
begin
  select game_id into v_game_id from public.allocations where id = p_allocation_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select is_closed into v_closed from public.games where id = v_game_id for update;
  select * into v_alloc from public.allocations where id = p_allocation_id for update;
  if v_alloc.status = 'cancelled' then
    return jsonb_build_object('ok', false, 'code', 'already_cancelled');
  end if;
  update public.allocations set status = 'cancelled', cancelled_at = now() where id = p_allocation_id;
  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (p_actor, 'allocation.cancelled', 'allocation', p_allocation_id,
    jsonb_build_object('game_id', v_game_id, 'client_id', v_alloc.client_id,
      'seats_restored', v_alloc.quantity, 'game_closed', v_closed, 'reason', p_reason));
  return jsonb_build_object('ok', true, 'seats_restored', v_alloc.quantity, 'game_closed', v_closed);
end $$;

-- Change how many tickets an allocation holds.
create or replace function public.admin_update_allocation_quantity(p_allocation_id uuid, p_quantity integer, p_actor text)
returns jsonb language plpgsql as $$
declare v_game public.games%rowtype; v_alloc public.allocations%rowtype; v_others integer;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('ok', false, 'code', 'invalid_quantity');
  end if;
  select * into v_alloc from public.allocations where id = p_allocation_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into v_game from public.games where id = v_alloc.game_id for update;
  select * into v_alloc from public.allocations where id = p_allocation_id for update;
  if v_alloc.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'code', 'not_active');
  end if;
  if v_alloc.quantity = p_quantity then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  select coalesce(sum(quantity), 0) into v_others from public.allocations
   where game_id = v_game.id and status = 'confirmed' and id <> p_allocation_id;
  if v_others + p_quantity > v_game.total_inventory then
    return jsonb_build_object('ok', false, 'code', 'insufficient',
      'max', v_game.total_inventory - v_others);
  end if;
  update public.allocations set quantity = p_quantity where id = p_allocation_id;
  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (p_actor, 'allocation.quantity_changed', 'allocation', p_allocation_id,
    jsonb_build_object('game_id', v_game.id, 'from', v_alloc.quantity, 'to', p_quantity));
  return jsonb_build_object('ok', true, 'old_quantity', v_alloc.quantity, 'new_quantity', p_quantity);
end $$;

-- Move an allocation's tickets to a different client.
create or replace function public.admin_reassign_allocation(p_allocation_id uuid, p_client_id uuid, p_actor text)
returns jsonb language plpgsql as $$
declare v_alloc public.allocations%rowtype;
begin
  select * into v_alloc from public.allocations where id = p_allocation_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  perform 1 from public.games where id = v_alloc.game_id for update;
  select * into v_alloc from public.allocations where id = p_allocation_id for update;
  if v_alloc.status <> 'confirmed' then
    return jsonb_build_object('ok', false, 'code', 'not_active');
  end if;
  if v_alloc.client_id = p_client_id then
    return jsonb_build_object('ok', false, 'code', 'same_client');
  end if;
  perform 1 from public.clients where id = p_client_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'client_not_found'); end if;
  update public.allocations set client_id = p_client_id where id = p_allocation_id;
  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (p_actor, 'allocation.reassigned', 'allocation', p_allocation_id,
    jsonb_build_object('game_id', v_alloc.game_id, 'from_client_id', v_alloc.client_id,
      'to_client_id', p_client_id, 'quantity', v_alloc.quantity));
  return jsonb_build_object('ok', true, 'previous_client_id', v_alloc.client_id);
end $$;

-- Change a game's total inventory (refuses to go below what's allocated).
create or replace function public.admin_set_game_inventory(p_game_id uuid, p_inventory integer, p_actor text)
returns jsonb language plpgsql as $$
declare v_game public.games%rowtype; v_allocated integer;
begin
  select * into v_game from public.games where id = p_game_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_inventory is null or p_inventory < 0 or p_inventory > 50 then
    return jsonb_build_object('ok', false, 'code', 'invalid_inventory');
  end if;
  select coalesce(sum(quantity), 0) into v_allocated
    from public.allocations where game_id = p_game_id and status = 'confirmed';
  if p_inventory < v_allocated then
    return jsonb_build_object('ok', false, 'code', 'below_allocated', 'allocated', v_allocated);
  end if;
  if p_inventory = v_game.total_inventory then
    return jsonb_build_object('ok', true, 'unchanged', true);
  end if;
  update public.games set total_inventory = p_inventory where id = p_game_id;
  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (p_actor, 'game.inventory_changed', 'game', p_game_id,
    jsonb_build_object('from', v_game.total_inventory, 'to', p_inventory, 'allocated', v_allocated));
  return jsonb_build_object('ok', true);
end $$;

-- Fixed-window rate limiter. Returns true when the call is allowed.
create or replace function public.hit_rate_limit(p_key text, p_max integer, p_window_seconds integer)
returns boolean language plpgsql as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = public.rate_limits.count + 1
  returning count into v_count;
  if random() < 0.02 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_count <= p_max;
end $$;

-- =====================================================================
-- Security: nothing is reachable with the public (anon) key.
-- All reads and writes go through the server using the service role key,
-- after the server has checked who is asking.
-- =====================================================================
alter table public.settings     enable row level security;
alter table public.admins       enable row level security;
alter table public.games        enable row level security;
alter table public.clients      enable row level security;
alter table public.allocations  enable row level security;
alter table public.email_logs   enable row level security;
alter table public.audit_log    enable row level security;
alter table public.rate_limits  enable row level security;
-- No policies are created, so the anon and authenticated roles are denied everything.

revoke all on all tables in schema public from anon, authenticated;
revoke all on public.game_availability from anon, authenticated;

revoke execute on function public.allocate_tickets(uuid, text, text, integer, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.admin_cancel_allocation(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.admin_update_allocation_quantity(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.admin_reassign_allocation(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.admin_set_game_inventory(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.hit_rate_limit(text, integer, integer) from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on function public.allocate_tickets(uuid, text, text, integer, text, text, text, uuid) to service_role;
grant execute on function public.admin_cancel_allocation(uuid, text, text) to service_role;
grant execute on function public.admin_update_allocation_quantity(uuid, integer, text) to service_role;
grant execute on function public.admin_reassign_allocation(uuid, uuid, text) to service_role;
grant execute on function public.admin_set_game_inventory(uuid, integer, text) to service_role;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;
