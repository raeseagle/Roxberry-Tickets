import 'server-only';
import { db } from './supabase/admin';
import type { Game, PublicGame } from './types';
import { addDaysIso, todayInSlc } from './format';

/** Last date (inclusive) visible to the public, given the rolling window. */
export function publicWindowEnd(windowDays: number) {
  return addDaysIso(todayInSlc(), Math.max(1, windowDays));
}

/** Upcoming, published games inside the public window, with only public-safe fields. */
export async function getPublicGames(windowDays: number): Promise<PublicGame[]> {
  const { data, error } = await db()
    .from('game_availability')
    .select('id,team,opponent,game_date,start_time,venue,total_inventory,remaining,is_closed')
    .eq('is_published', true)
    .gt('starts_at', new Date().toISOString())
    .lte('game_date', publicWindowEnd(windowDays))
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PublicGame[];
}

export async function getAllGames(): Promise<Game[]> {
  const { data, error } = await db()
    .from('game_availability')
    .select('*')
    .order('starts_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Game[];
}

export { availabilityOf, type Availability } from './availability';
