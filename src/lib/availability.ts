import type { Game } from './types';

export type Availability = 'available' | 'partial' | 'soldout' | 'closed';

export function availabilityOf(g: Pick<Game, 'is_closed' | 'remaining' | 'allocated' | 'total_inventory'>): Availability {
  if (g.is_closed) return 'closed';
  if (g.remaining <= 0) return 'soldout';
  if (g.allocated > 0) return 'partial';
  return 'available';
}
