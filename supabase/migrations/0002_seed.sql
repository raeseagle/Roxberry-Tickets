-- =====================================================================
-- Seed data for the Roxberry Juice Co. MOCK site: administrators and a
-- small sample of 8 real 2026-27 home games (dates, opponents and start
-- times taken from the official team schedules; all Mountain Time).
-- Replace these with Roxberry's actual games in the dashboard (Games →
-- Add game, or Games → Import from CSV) once the tickets are known.
-- Safe to re-run (existing rows are kept).
-- =====================================================================

insert into public.admins (email, role) values
  ('rseagle@millyresearch.com', 'owner'),
  ('chad.pehrson@gmail.com', 'owner')
on conflict (email) do nothing;

insert into public.games (team, opponent, game_date, start_time, venue, total_inventory, is_published) values
  ('mammoth', 'Tampa Bay Lightning', '2026-10-24', '19:00', 'Delta Center', 4, true),
  ('jazz', 'Los Angeles Lakers', '2026-10-25', '15:00', 'Delta Center', 4, true),
  ('jazz', 'Portland Trail Blazers', '2026-10-31', '13:00', 'Delta Center', 4, true),
  ('jazz', 'Miami Heat', '2026-11-10', '19:00', 'Delta Center', 4, true),
  ('mammoth', 'Colorado Avalanche', '2026-11-18', '19:00', 'Delta Center', 4, true),
  ('jazz', 'New York Knicks', '2026-12-30', '19:00', 'Delta Center', 4, true),
  ('mammoth', 'Boston Bruins', '2027-01-23', '19:00', 'Delta Center', 4, true),
  ('jazz', 'Detroit Pistons', '2027-02-15', '19:00', 'Delta Center', 4, true)
on conflict (team, game_date) do nothing;
