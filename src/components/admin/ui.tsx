import Link from 'next/link';
import { TEAMS } from '@/lib/teams';
import { availabilityOf, type Availability } from '@/lib/availability';
import type { Game } from '@/lib/types';

export function Flash({ searchParams }: { searchParams?: { msg?: string; err?: string } }) {
  if (searchParams?.err)
    return (
      <p role="alert" className="mb-5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
        {searchParams.err}
      </p>
    );
  if (searchParams?.msg)
    return (
      <p role="status" className="mb-5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
        {searchParams.msg}
      </p>
    );
  return null;
}

export function TeamTag({ team }: { team: string }) {
  const t = TEAMS[team as keyof typeof TEAMS];
  return (
    <span data-team={team} className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-silver-200">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--team)' }} />
      {t?.short ?? team}
    </span>
  );
}

const AV: Record<Availability, { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'border-emerald-400/40 text-emerald-200' },
  partial: { label: 'Partially claimed', cls: 'border-sky-400/40 text-sky-200' },
  soldout: { label: 'Sold out', cls: 'border-silver-400/40 text-silver-300' },
  closed: { label: 'Closed by admin', cls: 'border-amber-400/50 text-amber-200' },
};

export function AvailabilityBadge({ game }: { game: Pick<Game, 'is_closed' | 'remaining' | 'allocated' | 'total_inventory'> }) {
  const a = AV[availabilityOf(game)];
  return <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-xs ${a.cls}`}>{a.label}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-display text-4xl font-extrabold uppercase leading-none text-white">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const cls =
    status === 'confirmed' || status === 'sent'
      ? 'text-emerald-200 border-emerald-400/40'
      : status === 'failed'
        ? 'text-red-200 border-red-400/50'
        : 'text-silver-300 border-silver-400/40';
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-xs capitalize ${cls}`}>{status}</span>;
}

export function Back({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="mb-4 inline-block text-sm text-silver-400 hover:text-white">
      ← {label}
    </Link>
  );
}

/** "Reserved" (made by an admin), "Claimed" (requested on the website), or "Cancelled". */
export function KindTag({ source, status }: { source: string; status: string }) {
  if (status === 'cancelled') return <StatusPill status="cancelled" />;
  return source === 'admin' ? (
    <span className="inline-block rounded border border-amber-300/50 px-1.5 py-0.5 text-xs text-amber-100">Reserved</span>
  ) : (
    <span className="inline-block rounded border border-emerald-400/40 px-1.5 py-0.5 text-xs text-emerald-200">Claimed</span>
  );
}
