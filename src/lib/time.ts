// All schedule math runs in the shop's zone.
export const TZ = 'America/New_York';

const dtf = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function nyParts(d: Date) {
  const parts = dtf.formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)!.value;
  const year = Number(g('year'));
  const month = Number(g('month'));
  const day = Number(g('day'));
  const hour = Number(g('hour')) % 24;
  const minute = Number(g('minute'));
  const second = Number(g('second'));
  return {
    year, month, day, hour, minute, second,
    dow: WD[g('weekday')],
    dateKey: `${year}-${pad(month)}-${pad(day)}`,
    minutes: hour * 60 + minute,
  };
}

export const pad = (n: number) => String(n).padStart(2, '0');

function offsetMin(d: Date) {
  const p = nyParts(d);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Wall clock time in New York (date key + minutes after midnight) to a real instant. */
export function nyToUtc(dateKey: string, minutes = 0): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const o1 = offsetMin(new Date(guess));
  let t = guess - o1 * 60000;
  const o2 = offsetMin(new Date(t));
  if (o2 !== o1) t = guess - o2 * 60000;
  return new Date(t);
}

export function isDateKey(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
}

export function todayKey() {
  return nyParts(new Date()).dateKey;
}

export function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function dowOf(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday of the week containing key. */
export function weekStart(key: string) {
  const dow = dowOf(key);
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

export function hhmm(minutes: number) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function parseHHMM(s: unknown): number | null {
  if (typeof s !== 'string' || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function fmtClock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(d).toLocaleDateString('en-US', { timeZone: TZ, ...opts });
}

export function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
}

export function fmtDateTime(d: Date | string) {
  return `${fmtDate(d, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${fmtTime(d)}`;
}

export function fmtKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  return nyToUtc(key, 12 * 60).toLocaleDateString('en-US', { timeZone: TZ, ...opts });
}

export const money = (cents: number | string | null | undefined) =>
  '$' + (Number(cents || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
