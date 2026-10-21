'use client';

import { useEffect, useRef, useState } from 'react';
import type { PublicGame } from '@/lib/types';
import { TEAMS } from '@/lib/teams';
import { EMAIL_RE, fmtDateLong, fmtTime, seatLabel } from '@/lib/format';

type Props = {
  game: PublicGame;
  onClose: () => void;
  onAllocated: (gameId: string, remaining: number) => void;
  onAvailabilityChange: (remaining: number) => void;
};

type Phase = 'form' | 'submitting' | 'success' | 'unavailable';

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

export default function RequestModal({ game, onClose, onAllocated, onAvailabilityChange }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const maxQty = Math.max(0, Math.min(game.remaining, 4));
  const [qty, setQty] = useState(1);
  const [errors, setErrors] = useState<{ name?: string; email?: string; form?: string }>({});
  const [result, setResult] = useState<{ quantity: number; remaining: number } | null>(null);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');

  // One key per attempt. Reused on network retries so a request is never processed twice.
  const keyRef = useRef(newKey());
  const openedAt = useRef(Date.now());
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstField = useRef<HTMLInputElement>(null);
  const lastFocus = useRef<Element | null>(null);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Clamp the selection if seats disappear while the form is open.
  useEffect(() => {
    if (qty > maxQty && maxQty > 0) setQty(maxQty);
  }, [maxQty, qty]);

  useEffect(() => {
    lastFocus.current = document.activeElement;
    firstField.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phaseRef.current !== 'submitting') closeRef.current();
      if (e.key === 'Tab' && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, a[href]');
        const items = Array.from(f).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.();
    };
  }, []);

  function validate() {
    const e: typeof errors = {};
    if (name.trim().length < 2) e.name = 'Enter your full name.';
    if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address, like name@company.com.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (phase === 'submitting') return; // ignore repeated clicks
    if (!validate() || maxQty === 0) return;
    setPhase('submitting');
    setErrors({});
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: game.id,
          fullName: name.trim(),
          email: email.trim(),
          quantity: qty,
          idempotencyKey: keyRef.current,
          website,
          elapsedMs: Date.now() - openedAt.current,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setResult({ quantity: json.quantity ?? qty, remaining: json.remaining ?? 0 });
        setPhase('success');
        onAllocated(game.id, json.remaining ?? 0);
        return;
      }
      // A definitive answer from the server: the next attempt gets a fresh key.
      keyRef.current = newKey();
      if (json.code === 'insufficient' || json.code === 'closed' || json.code === 'past' || json.code === 'not_found') {
        if (typeof json.remaining === 'number') onAvailabilityChange(json.remaining);
        setMessage(json.message);
        setPhase(typeof json.remaining === 'number' && json.remaining > 0 ? 'form' : 'unavailable');
        if (typeof json.remaining === 'number' && json.remaining > 0) {
          setErrors({
            form: `${json.message} There ${json.remaining === 1 ? 'is' : 'are'} still ${json.remaining} ${json.remaining === 1 ? 'seat' : 'seats'} left — choose a smaller number and try again.`,
          });
        }
        return;
      }
      setErrors({ form: json.message ?? 'Something went wrong. Please try again.' });
      setPhase('form');
    } catch {
      // Network problem: keep the same key so a retry can't double-book.
      setErrors({ form: 'We couldn’t reach the server. Check your connection and press Submit Request again.' });
      setPhase('form');
    }
  }

  const team = TEAMS[game.team];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" data-team={game.team}>
      <div className="fade-in absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={() => phase !== 'submitting' && onClose()} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="req-title"
        className="modal-in relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-navy-700 bg-navy-900 shadow-2xl sm:rounded-2xl"
      >
        <div className="h-1.5 rounded-t-2xl" style={{ background: 'var(--team)' }} />
        <div className="p-6 sm:p-8">
          <p className="font-cond text-sm font-bold" style={{ color: 'var(--team-accent)' }}>
            {team.name} vs.
          </p>
          <h2 id="req-title" className="font-display text-4xl font-extrabold uppercase leading-[0.95] text-white">
            {game.opponent}
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-silver-500">Date</dt>
              <dd className="text-silver-100">{fmtDateLong(game.game_date)}</dd>
            </div>
            <div>
              <dt className="text-silver-500">Start time</dt>
              <dd className="text-silver-100">{fmtTime(game.start_time)} MT</dd>
            </div>
            <div>
              <dt className="text-silver-500">Venue</dt>
              <dd className="text-silver-100">{game.venue}</dd>
            </div>
            <div>
              <dt className="text-silver-500">Remaining</dt>
              <dd className="font-semibold text-white">{game.is_closed ? 'Closed' : seatLabel(game.remaining)}</dd>
            </div>
          </dl>

          {phase === 'success' && result ? (
            <div className="mt-7" role="status">
              <p className="font-display text-3xl font-extrabold uppercase text-white">You&rsquo;re in.</p>
              <p className="mt-2 leading-relaxed text-silver-200">
                {result.quantity} {result.quantity === 1 ? 'ticket is' : 'tickets are'} yours for {team.name} vs. {game.opponent}. The Roxberry team will reach out to{' '}
                <span className="font-semibold text-white">{email.trim()}</span> with ticket details before the game.
              </p>
              <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-white px-4 py-3 font-semibold text-navy-900">
                Back to games
              </button>
            </div>
          ) : phase === 'unavailable' || maxQty === 0 ? (
            <div className="mt-7" role="alert">
              <p className="leading-relaxed text-silver-100">
                {message ||
                  'Looks like someone beat you to those seats! This game no longer has enough tickets available for your request. Please check the remaining games for another opportunity.'}
              </p>
              <button type="button" onClick={onClose} className="mt-6 w-full rounded-lg bg-white px-4 py-3 font-semibold text-navy-900">
                See other games
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="mt-7 space-y-4">
              {errors.form && (
                <p role="alert" className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm leading-relaxed text-amber-100">
                  {errors.form}
                </p>
              )}
              <div>
                <label htmlFor="req-name" className="mb-1.5 block text-sm font-semibold text-silver-200">
                  Full name
                </label>
                <input
                  ref={firstField}
                  id="req-name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'req-name-err' : undefined}
                  maxLength={120}
                  className="w-full rounded-lg border border-navy-600 bg-navy-950 px-4 py-3 text-white placeholder:text-silver-500 focus:border-white focus:outline-none"
                />
                {errors.name && (
                  <p id="req-name-err" className="mt-1 text-sm text-amber-200">
                    {errors.name}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="req-email" className="mb-1.5 block text-sm font-semibold text-silver-200">
                  Email address
                </label>
                <input
                  id="req-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'req-email-err' : undefined}
                  maxLength={254}
                  className="w-full rounded-lg border border-navy-600 bg-navy-950 px-4 py-3 text-white placeholder:text-silver-500 focus:border-white focus:outline-none"
                />
                {errors.email && (
                  <p id="req-email-err" className="mt-1 text-sm text-amber-200">
                    {errors.email}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="req-qty" className="mb-1.5 block text-sm font-semibold text-silver-200">
                  Number of tickets
                </label>
                <select
                  id="req-qty"
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full rounded-lg border border-navy-600 bg-navy-950 px-4 py-3 text-white focus:border-white focus:outline-none"
                >
                  {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'ticket' : 'tickets'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Spam trap: hidden from people, tempting to bots. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="req-website">Website</label>
                <input id="req-website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={phase === 'submitting'}
                  className="rounded-lg border border-navy-600 px-5 py-3 font-semibold text-silver-200 hover:border-silver-400 sm:w-1/3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={phase === 'submitting'}
                  aria-busy={phase === 'submitting'}
                  className="flex-1 rounded-lg px-5 py-3 font-cond text-lg font-bold tracking-wide disabled:opacity-70"
                  style={{ background: 'var(--team)', color: 'var(--team-ink)' }}
                >
                  {phase === 'submitting' ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
              <p className="text-xs leading-relaxed text-silver-500">
                Your name and email are used only to manage this request and related messages.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
