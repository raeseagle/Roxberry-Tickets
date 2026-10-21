import type { Team } from './types';

export const TEAMS: Record<Team, { name: string; short: string; sport: string }> = {
  jazz: { name: 'Utah Jazz', short: 'Jazz', sport: 'NBA' },
  mammoth: { name: 'Utah Mammoth', short: 'Mammoth', sport: 'NHL' },
};

export function teamName(t: string) {
  return TEAMS[t as Team]?.name ?? t;
}
