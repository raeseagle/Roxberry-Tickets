'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicGame, Team } from '@/lib/types';
import { TEAMS } from '@/lib/teams';
import { dateParts, fmtTime, monthName, parseDate, seatLabel } from '@/lib/format';
import RequestModal from './RequestModal';

type Props = {
  initialGames: PublicGame[];
  defaultTab: Team;
  windowDays: number;
  showVenue: boolean;
  showTotal: boolean;
};

const POLL_MS = 20_000;

const windowLabel = (days: number) => (days % 7 === 0 ? `${days / 7} ${days === 7 ? 'week' : 'weeks'}` : `${days} days`);

export default function GameBoard({ initialGames, defaultTab, windowDays, showVenue, showTotal }: Props) {
  const [games, setGames] = useState(initialGames);
  const [tab, setTab] = useState<Team>(defaultTab);
  const [active, setActive] = useState<PublicGame | null>(null);
  const tabRefs = useRef<Record<Team, HTMLButtonElement | null>>({ jazz: null, mammoth: null });

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/games', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.games)) setGames(json.games);
    } catch {
      /* keep showing what we have */
    }
  }, []);

  useEffect(() => {
    const id = setInterval(refresh, POLL_MS);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  // Keep the open modal in sync with the latest availability.
  const activeLive = active ? games.find((g) => g.id === active.id) ?? active : null;

  const byTeam = useMemo(() => {
    const groups: Record<Team, PublicGame[]> = { jazz: [], mammoth: [] };
    for (const g of games) groups[g.team]?.push(g);
    return groups;
  }, [games]);

  const list = byTeam[tab];
  const months = useMemo(() => {
    const out: { key: string; label: string; games: PublicGame[] }[] = [];
    for (const g of list) {
      const p = parseDate(g.game_date);
      const key = `${p.y}-${p.m}`;
      let bucket = out.find((b) => b.key === key);
      if (!bucket) {
        bucket = { key, label: `${monthName(p.m - 1)} ${p.y}`, games: [] };
        out.push(bucket);
      }
      bucket.games.push(g);
    }
    return out;
  }, [list]);

  function onTabKey(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const next: Team = tab === 'jazz' ? 'mammoth' : 'jazz';
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  function onAllocated(gameId: string, remaining: number) {
    setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, remaining } : g)));
    refresh();
  }

  return (
    <div className="-mt-8">
      <div role="tablist" aria-label="Choose a team" className="grid grid-cols-2 gap-3 sm:max-w-xl" onKeyDown={onTabKey}>
        {(Object.keys(TEAMS) as Team[]).map((t) => {
          const selected = t === tab;
          const open = byTeam[t].filter((g) => g.remaining > 0 && !g.is_closed).length;
          return (
            <button
              key={t}
              ref={(el) => {
                tabRefs.current[t] = el;
              }}
              role="tab"
              id={`tab-${t}`}
              aria-selected={selected}
              aria-controls={`panel-${t}`}
              tabIndex={selected ? 0 : -1}
              data-team={t}
              onClick={() => setTab(t)}
              className={`relative overflow-hidden rounded-xl border px-4 py-4 text-left transition-colors sm:px-5 ${
                selected ? 'border-[var(--team)] bg-navy-850' : 'border-navy-700 bg-navy-900 hover:border-navy-600'
              }`}
            >
              <span
                className={`absolute inset-x-0 bottom-0 h-1 transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'var(--team)' }}
              />
              <span className="block font-display text-[1.3rem] font-extrabold uppercase leading-none text-white sm:text-4xl">
                {TEAMS[t].name}
              </span>
              <span className="mt-1.5 block text-sm text-silver-400">
                {open} {open === 1 ? 'game' : 'games'} with seats open
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-silver-400">Showing games in the next {windowLabel(windowDays)}. New games open up every week.</p>

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        data-team={tab}
        className="mt-10"
        key={tab}
      >
        {list.length === 0 ? (
          <div className="panel fade-in max-w-xl">
            <p className="font-semibold text-white">No {TEAMS[tab].name} home games in the next {windowLabel(windowDays)}.</p>
            <p className="mt-1 text-silver-400">Check the other tab, or come back soon — new games open up every week.</p>
          </div>
        ) : (
          months.map((m) => (
            <div key={m.key} className="mb-10 fade-in">
              <h2 className="mb-4 font-display text-2xl font-extrabold uppercase text-silver-300">{m.label}</h2>
              <ul className="space-y-4">
                {m.games.map((g) => (
                  <li key={g.id}>
                    <GameCard game={g} showVenue={showVenue} showTotal={showTotal} onRequest={() => setActive(g)} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>

      {activeLive && (
        <RequestModal
          game={activeLive}
          onClose={() => setActive(null)}
          onAllocated={onAllocated}
          onAvailabilityChange={(remaining) => onAllocated(activeLive.id, remaining)}
        />
      )}
    </div>
  );
}

function GameCard({
  game,
  showVenue,
  showTotal,
  onRequest,
}: {
  game: PublicGame;
  showVenue: boolean;
  showTotal: boolean;
  onRequest: () => void;
}) {
  const d = dateParts(game.game_date);
  const out = game.remaining <= 0 || game.is_closed;
  const status = game.is_closed ? 'Closed' : seatLabel(game.remaining);
  const seats = Math.min(game.total_inventory, 8);

  return (
    <article data-team={game.team} className={`ticket ${out ? 'is-out' : ''}`} aria-label={`${TEAMS[game.team].name} vs. ${game.opponent}`}>
      <div className="ticket-date flex flex-col items-center justify-center px-2 py-5 text-center">
        <span className="font-cond text-sm font-semibold text-silver-400">{d.dow}</span>
        <span className="font-display text-5xl font-black leading-none text-white">{d.day}</span>
        <span className="font-cond text-sm font-semibold text-silver-300">{d.month}</span>
      </div>

      <div className="ticket-main min-w-0 px-5 py-5 sm:px-6">
        <p className="flex flex-wrap items-center gap-2">
          <span
            className="rounded px-2 py-0.5 font-cond text-xs font-bold tracking-wide text-navy-950"
            style={{ background: 'var(--team-accent)' }}
          >
            {TEAMS[game.team].name}
          </span>
          <span className="text-sm text-silver-400">vs.</span>
        </p>
        <h3 className="mt-1.5 font-display text-3xl font-extrabold uppercase leading-[0.95] text-white sm:text-4xl">{game.opponent}</h3>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-silver-300">
          <span>
            <span className="text-silver-500">Starts </span>
            {fmtTime(game.start_time)} MT
          </span>
          {showVenue && (
            <span>
              <span className="text-silver-500">at </span>
              {game.venue}
            </span>
          )}
        </p>
      </div>

      <div className="ticket-stub flex flex-col justify-center gap-3 px-5 py-5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div>
            <p className={`whitespace-nowrap font-cond text-lg font-bold leading-tight ${out ? 'text-silver-400' : 'text-white'}`} aria-live="polite">
              {status}
            </p>
            {showTotal && <p className="text-xs text-silver-500">{game.total_inventory} seats total</p>}
          </div>
          <div className="flex gap-2 pb-1.5" aria-hidden="true">
            {Array.from({ length: seats }).map((_, i) => (
              <span key={i} className={`seat ${i < game.remaining && !game.is_closed ? 'open' : ''}`} />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onRequest}
          disabled={out}
          className="w-full rounded-lg px-4 py-3 font-cond text-lg font-bold tracking-wide transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-not-allowed"
          style={out ? { background: '#771674', color: '#C99AC6' } : { background: 'var(--team)', color: 'var(--team-ink)' }}
        >
          {out ? status : 'Request Tickets'}
        </button>
      </div>
    </article>
  );
}
