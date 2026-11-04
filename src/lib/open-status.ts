// Browser safe: open or closed status from weekly hours, always in shop time (America/New_York).
export type Period = { open: number; close: number };
export type WeeklyHours = Record<number, Period[]>;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function fmtHour(t: number) {
  const h = Math.floor(t) % 24;
  const m = Math.round((t % 1) * 60);
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Day of week and decimal hour in New York, wherever the visitor is. */
export function shopNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '0';
  return { dow: WD[g('weekday')] ?? now.getDay(), t: (Number(g('hour')) % 24) + Number(g('minute')) / 60 };
}

export function openStatus(hours: WeeklyHours, now = new Date()) {
  const { dow, t } = shopNow(now);
  const today = (hours[dow] || []).slice().sort((a, b) => a.open - b.open);
  const cur = today.find((p) => t >= p.open && t < p.close);
  if (cur) return { dow, open: true, msg: `Open now until ${fmtHour(cur.close)}` };
  const later = today.find((p) => t < p.open);
  if (later) return { dow, open: false, msg: today.some((p) => t >= p.close) ? `Closed now · Back at ${fmtHour(later.open)}` : `Opens ${fmtHour(later.open)} today` };
  for (let i = 1; i <= 7; i++) {
    const n = (dow + i) % 7;
    const first = (hours[n] || []).slice().sort((a, b) => a.open - b.open)[0];
    if (first) return { dow, open: false, msg: `Closed now · Opens ${i === 1 ? 'tomorrow' : DAY_NAMES[n]} ${fmtHour(first.open)}` };
  }
  return { dow, open: false, msg: 'Call or text for hours' };
}
