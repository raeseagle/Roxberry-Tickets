'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { availabilityOf, type Availability } from '@/lib/availability';
import { TEAMS } from '@/lib/teams';
import { fmtDateLong, fmtTime, monthName, parseDate } from '@/lib/format';
import type { Team } from '@/lib/types';

export type CalGame = {
  id: string;
  team: Team;
  opponent: string;
  game_date: string;
  start_time: string;
  venue: string;
  total_inventory: number;
  allocated: number;
  remaining: number;
  is_closed: boolean;
  is_published: boolean;
  allocations: { id: string; quantity: number; name: string; email: string; reserved: boolean; note: string }[];
};

type View = 'month' | 'week' | 'agenda';
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const AV_LABEL: Record<Availability, string> = {
  available: 'Available',
  partial: 'Partially claimed',
  soldout: 'Sold out',
  closed: 'Closed by admin',
};

// Pure date helpers on "YYYY-MM-DD" strings (no timezone math needed).
const iso = (d: Date) => d.toISOString().slice(0, 10);
const toDate = (s: string) => {
  const p = parseDate(s);
  return new Date(Date.UTC(p.y, p.m - 1, p.day));
};
const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const startOfWeek = (s: string) => addDays(s, -toDate(s).getUTCDay());
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function Calendar({ games }: { games: CalGame[] }) {
  const today = todayLocal();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => {
    const next = games.find((g) => g.game_date >= today);
    return next ? next.game_date : today;
  });
  const [team, setTeam] = useState<'all' | Team>('all');
  const [avail, setAvail] = useState<'all' | Availability>('all');
  const [showPast, setShowPast] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      games.filter(
        (g) =>
          (team === 'all' || g.team === team) &&
          (avail === 'all' || availabilityOf(g) === avail),
      ),
    [games, team, avail],
  );
  const byDate = useMemo(() => {
    const m = new Map<string, CalGame[]>();
    for (const g of filtered) m.set(g.game_date, [...(m.get(g.game_date) ?? []), g]);
    return m;
  }, [filtered]);

  const selected = selectedId ? games.find((g) => g.id === selectedId) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedId(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const c = parseDate(cursor);
  function move(dir: 1 | -1) {
    if (view === 'month') {
      const d = new Date(Date.UTC(c.y, c.m - 1 + dir, 1));
      setCursor(iso(d));
    } else setCursor(addDays(cursor, 7 * dir));
  }

  let title = '';
  if (view === 'month') title = `${monthName(c.m - 1)} ${c.y}`;
  else if (view === 'week') {
    const s = startOfWeek(cursor);
    const e = addDays(s, 6);
    const ps = parseDate(s);
    const pe = parseDate(e);
    title = `${monthName(ps.m - 1).slice(0, 3)} ${ps.day} – ${monthName(pe.m - 1).slice(0, 3)} ${pe.day}, ${pe.y}`;
  } else title = 'All games';

  return (
    <div>
      {/* Controls */}
      <div className="panel mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex overflow-hidden rounded-md border border-navy-700" role="group" aria-label="View">
          {(['month', 'week', 'agenda'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-3 py-2 text-sm capitalize ${view === v ? 'bg-white font-semibold text-navy-900' : 'text-silver-200 hover:bg-navy-800'}`}
            >
              {v === 'agenda' ? 'List' : v}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="cal-team">
            Team
          </label>
          <select id="cal-team" className="field" value={team} onChange={(e) => setTeam(e.target.value as any)}>
            <option value="all">Both teams</option>
            <option value="jazz">Utah Jazz</option>
            <option value="mammoth">Utah Mammoth</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cal-avail">
            Availability
          </label>
          <select id="cal-avail" className="field" value={avail} onChange={(e) => setAvail(e.target.value as any)}>
            <option value="all">Any</option>
            {(Object.keys(AV_LABEL) as Availability[]).map((a) => (
              <option key={a} value={a}>
                {AV_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="cal-date">
            {view === 'agenda' ? 'From date' : 'Go to date'}
          </label>
          <input id="cal-date" type="date" className="field" value={cursor} onChange={(e) => e.target.value && setCursor(e.target.value)} />
        </div>
        {view === 'agenda' && (
          <label className="flex items-center gap-2 pb-2 text-sm text-silver-300">
            <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show all dates
          </label>
        )}
        <div className="ml-auto flex items-center gap-3 pb-1 text-xs text-silver-300">
          <Legend team="jazz" />
          <Legend team="mammoth" />
        </div>
      </div>

      {view !== 'agenda' && (
        <div className="mb-3 flex items-center gap-2">
          <button type="button" className="btn-ghost px-2.5" onClick={() => move(-1)} aria-label="Previous">
            ‹
          </button>
          <button type="button" className="btn-ghost px-2.5" onClick={() => move(1)} aria-label="Next">
            ›
          </button>
          <button type="button" className="btn-ghost" onClick={() => setCursor(today)}>
            Today
          </button>
          <h2 className="ml-2 font-display text-2xl font-extrabold uppercase text-white">{title}</h2>
        </div>
      )}

      {view === 'month' && <MonthGrid cursor={cursor} today={today} byDate={byDate} onPick={setSelectedId} />}
      {view === 'week' && <WeekGrid start={startOfWeek(cursor)} today={today} byDate={byDate} onPick={setSelectedId} />}
      {view === 'agenda' && <Agenda games={filtered.filter((g) => showPast || g.game_date >= cursor)} onPick={setSelectedId} />}

      {selected && <Detail game={selected} onClose={() => setSelectedId(null)} />}
    </div>
  );
}

function Legend({ team }: { team: Team }) {
  return (
    <span data-team={team} className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm" style={{ background: 'var(--team)' }} />
      {TEAMS[team].name}
    </span>
  );
}

function Chip({ g, onPick, roomy = false }: { g: CalGame; onPick: (id: string) => void; roomy?: boolean }) {
  const a = availabilityOf(g);
  return (
    <button
      type="button"
      data-team={g.team}
      onClick={() => onPick(g.id)}
      className={`block w-full rounded-md border-l-[3px] px-1.5 py-1 text-left text-xs transition-colors hover:bg-navy-700 ${
        g.is_published ? 'bg-navy-800' : 'bg-navy-900 opacity-70'
      }`}
      style={{ borderColor: 'var(--team)' }}
      title={`${TEAMS[g.team].name} vs. ${g.opponent}`}
    >
      <span className="block truncate font-semibold text-white">
        {fmtTime(g.start_time)} {g.opponent}
      </span>
      <span className={`block ${a === 'closed' ? 'text-amber-200' : a === 'soldout' ? 'text-silver-400' : 'text-silver-300'}`}>
        {a === 'closed' ? 'Closed' : `${g.allocated}/${g.total_inventory} taken · ${g.remaining} left`}
        {!g.is_published && ' · draft'}
      </span>
      {roomy && g.allocations.length > 0 && (
        <span className="mt-1 block truncate text-silver-400">{g.allocations.map((x) => x.name).join(', ')}</span>
      )}
    </button>
  );
}

function MonthGrid({ cursor, today, byDate, onPick }: { cursor: string; today: string; byDate: Map<string, CalGame[]>; onPick: (id: string) => void }) {
  const c = parseDate(cursor);
  const first = `${c.y}-${String(c.m).padStart(2, '0')}-01`;
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const weeks = days[35].slice(0, 7) === first.slice(0, 7) ? 6 : 5;
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 overflow-hidden rounded-xl border border-navy-700">
        {DOW.map((d) => (
          <div key={d} className="border-b border-navy-700 bg-navy-900 px-2 py-1.5 text-xs font-semibold text-silver-400">
            {d}
          </div>
        ))}
        {days.slice(0, weeks * 7).map((d) => {
          const inMonth = d.slice(0, 7) === first.slice(0, 7);
          const list = byDate.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[7rem] border-b border-r border-navy-800 p-1.5 ${inMonth ? 'bg-navy-950' : 'bg-navy-950/40'}`}>
              <div
                className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                  d === today ? 'bg-white font-bold text-navy-900' : inMonth ? 'text-silver-300' : 'text-silver-500'
                }`}
              >
                {parseDate(d).day}
              </div>
              <div className="space-y-1">
                {list.map((g) => (
                  <Chip key={g.id} g={g} onPick={onPick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekGrid({ start, today, byDate, onPick }: { start: string; today: string; byDate: Map<string, CalGame[]>; onPick: (id: string) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[720px] grid-cols-7 gap-2">
        {days.map((d) => {
          const p = parseDate(d);
          const list = byDate.get(d) ?? [];
          return (
            <div key={d} className={`min-h-[16rem] rounded-xl border p-2 ${d === today ? 'border-silver-300' : 'border-navy-700'} bg-navy-900`}>
              <p className="text-xs font-semibold text-silver-400">{DOW[p.dow]}</p>
              <p className="font-display text-3xl font-black text-white">{p.day}</p>
              <div className="mt-2 space-y-1.5">
                {list.map((g) => (
                  <Chip key={g.id} g={g} onPick={onPick} roomy />
                ))}
                {!list.length && <p className="text-xs text-silver-500">No games</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Agenda({ games, onPick }: { games: CalGame[]; onPick: (id: string) => void }) {
  if (!games.length) return <p className="panel text-silver-300">No games match these filters.</p>;
  return (
    <div className="panel overflow-x-auto p-0">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Team</th>
            <th>Opponent</th>
            <th>Inventory</th>
            <th>Allocated</th>
            <th>Remaining</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} className="cursor-pointer" onClick={() => onPick(g.id)}>
              <td className="whitespace-nowrap">
                <button type="button" className="text-left font-semibold text-white hover:underline" onClick={() => onPick(g.id)}>
                  {fmtDateLong(g.game_date)}
                </button>
                <div className="text-xs text-silver-500">{fmtTime(g.start_time)} MT</div>
              </td>
              <td>
                <span data-team={g.team} className="inline-flex items-center gap-1.5 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--team)' }} />
                  {TEAMS[g.team].short}
                </span>
              </td>
              <td className="text-silver-100">{g.opponent}</td>
              <td>{g.total_inventory}</td>
              <td>{g.allocated}</td>
              <td className="font-semibold text-white">{g.remaining}</td>
              <td className="text-xs text-silver-300">
                {AV_LABEL[availabilityOf(g)]}
                {!g.is_published && <span className="block text-silver-500">Unpublished</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Detail({ game, onClose }: { game: CalGame; onClose: () => void }) {
  const a = availabilityOf(game);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fade-in absolute inset-0 bg-navy-950/70" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-detail-title"
        data-team={game.team}
        className="modal-in relative h-full w-full max-w-md overflow-y-auto border-l border-navy-700 bg-navy-900 p-6"
      >
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: 'var(--team)' }} />
        <button type="button" onClick={onClose} className="btn-ghost absolute right-4 top-4 px-2 py-1 text-xs">
          Close
        </button>
        <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--team-accent)' }}>
          {TEAMS[game.team].name} vs.
        </p>
        <h2 id="cal-detail-title" className="font-display text-4xl font-extrabold uppercase leading-none text-white">
          {game.opponent}
        </h2>
        <p className="mt-3 text-silver-200">
          {fmtDateLong(game.game_date)} at {fmtTime(game.start_time)} MT
        </p>
        <p className="text-sm text-silver-400">{game.venue}</p>

        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ['Inventory', game.total_inventory],
            ['Allocated', game.allocated],
            ['Remaining', game.remaining],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-lg border border-navy-700 py-2">
              <dt className="text-xs text-silver-400">{k}</dt>
              <dd className="font-display text-3xl font-black text-white">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm text-silver-300">
          {AV_LABEL[a]}
          {!game.is_published && ' · not visible on the public site'}
        </p>

        <h3 className="mt-6 font-semibold text-white">Clients attending</h3>
        {game.allocations.length === 0 ? (
          <p className="mt-2 text-sm text-silver-400">No seats have been allocated for this game yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-navy-700 rounded-lg border border-navy-700">
            {game.allocations.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <Link href={`/admin/allocations/${x.id}`} className="block truncate font-semibold text-white hover:underline">
                    {x.name}
                  </Link>
                  <p className="truncate text-xs text-silver-400">
                    {x.reserved ? <span className="text-amber-100">Reserved</span> : 'Claimed'}
                    {x.email ? ` · ${x.email}` : ''}
                    {x.note ? ` · ${x.note}` : ''}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm text-silver-200">
                  {x.quantity} {x.quantity === 1 ? 'ticket' : 'tickets'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/admin/games/${game.id}`} className="btn-primary mt-6 w-full">
          Manage this game
        </Link>
      </aside>
    </div>
  );
}
