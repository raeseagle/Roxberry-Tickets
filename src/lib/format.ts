const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Parses a YYYY-MM-DD local date without any timezone shifting. */
export function parseDate(d: string) {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return { y, m, day, dow };
}

export function fmtDate(d: string) {
  const p = parseDate(d);
  return `${DAYS[p.dow]}, ${MONTHS[p.m - 1]} ${p.day}, ${p.y}`;
}
export function fmtDateLong(d: string) {
  const p = parseDate(d);
  return `${DAYS_LONG[p.dow]}, ${MONTHS_LONG[p.m - 1]} ${p.day}, ${p.y}`;
}
export function dateParts(d: string) {
  const p = parseDate(d);
  return { dow: DAYS[p.dow], month: MONTHS[p.m - 1], day: p.day, year: p.y };
}
export function monthName(m: number) {
  return MONTHS_LONG[m];
}

/** "19:30:00" -> "7:30 PM" */
export function fmtTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtGame(g: { game_date: string; start_time: string }) {
  return `${fmtDate(g.game_date)} at ${fmtTime(g.start_time)} MT`;
}

/** A timestamp shown in Salt Lake City time. */
export function fmtStamp(iso: string | null | undefined) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function seatLabel(remaining: number) {
  if (remaining <= 0) return 'Sold Out';
  return `${remaining} ${remaining === 1 ? 'Seat' : 'Seats'} Available`;
}

/** Accepts "19:30", "7:30 PM", "7 p.m.", "7:30pm". Returns HH:MM or null. */
export function parseTime(input: string): string | null {
  const s = input.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, '');
  if (s === 'noon') return '12:00';
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Accepts YYYY-MM-DD or M/D/YYYY. Returns YYYY-MM-DD or null. */
export function parseDateInput(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else {
    match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    [m, d, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function normalizeEmail(e: string) {
  return e.trim().toLowerCase();
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Today's date in Salt Lake City as YYYY-MM-DD. */
export function todayInSlc() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDaysIso(date: string, days: number) {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}
