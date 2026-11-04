import { sql } from './db';
import { freeBusy, type Busy } from './google';
import { getWeeklyHours } from './catalog';
import { addDays, dowOf, fmtClock, hhmm, nyParts, nyToUtc, todayKey } from './time';
import { squareReady, searchAvailability, type SquareSlot } from './square';

export const SLOT_STEP = 30; // minutes between start times (local mode)
export const LEAD_MIN = 60; // no bookings less than this far out
export const HORIZON_DAYS = 60;
export const BLOCKING_STATUSES = ['inquiry', 'confirmed', 'completed'];

export type Hours = Record<number, { open: number; close: number } | null>;

/** One span per day (earliest open to latest close) for the admin calendar grid. Hours come from Square when synced. */
export async function getHours(): Promise<Hours> {
  const { hours } = await getWeeklyHours();
  const out: Hours = {};
  for (let d = 0; d < 7; d++) {
    const p = hours[d] || [];
    out[d] = p.length ? { open: Math.min(...p.map((x) => x.open)), close: Math.max(...p.map((x) => x.close)) } : null;
  }
  return out;
}

export type ServiceRow = { id: string; name: string; description: string; duration_min: number; price_cents: number; square_variation_id: string | null };

export async function getService(id: string) {
  const rows = await sql()`select id, name, description, duration_min, price_cents, square_variation_id from services where id = ${id} and active = true`;
  return rows[0] as ServiceRow | undefined;
}

export type Slot = { time: string; label: string; startsAt: string; square?: SquareSlot };

/** Local busy time: blocks, Google busy, and appointments. In Square mode Square already knows its own bookings, so only local-only appointments count. */
export async function busyRanges(from: Date, to: Date, opts: { squareMode?: boolean } = {}) {
  const q = sql();
  const [appts, blocks, google] = await Promise.all([
    q`select id, starts_at, ends_at, square_booking_id from appointments
       where status = any(${BLOCKING_STATUSES}) and starts_at < ${to.toISOString()} and ends_at > ${from.toISOString()}`,
    q`select starts_at, ends_at from blocks where starts_at < ${to.toISOString()} and ends_at > ${from.toISOString()}`,
    freeBusy(from, to),
  ]);
  const busy: Busy[] = [
    ...appts.filter((a) => !(opts.squareMode && a.square_booking_id)).map((a) => ({ start: new Date(a.starts_at), end: new Date(a.ends_at) })),
    ...blocks.map((b) => ({ start: new Date(b.starts_at), end: new Date(b.ends_at) })),
    ...google.busy,
  ];
  return { busy, googleConnected: google.connected };
}

export type Availability = { service: ServiceRow; days: Record<string, Slot[]>; mode: 'square' | 'local'; googleConnected: boolean; squareError?: string };

/**
 * Open start times per NY date for a service.
 * Square mode: Square SearchAvailability (respects Square hours, bookings, and blocked time) minus local blocks and Google busy.
 * Local mode (Square not connected or service not mapped): posted hours (Square hours when synced) minus appointments, blocks, Google busy.
 */
export async function availability(serviceId: string, startKey: string, days: number): Promise<Availability | null> {
  const svc = await getService(serviceId);
  if (!svc) return null;
  const today = todayKey();
  const lastKey = addDays(today, HORIZON_DAYS);
  const from = nyToUtc(startKey, 0);
  const to = nyToUtc(addDays(startKey, days), 0);
  const earliest = Date.now() + LEAD_MIN * 60000;
  const out: Record<string, Slot[]> = {};
  for (let i = 0; i < days; i++) out[addDays(startKey, i)] = [];

  const sqc = await squareReady().catch(() => null);
  let squareError: string | undefined;
  if (sqc && svc.square_variation_id) {
    try {
      const searchFrom = new Date(Math.max(from.getTime(), earliest));
      const [slots, { busy, googleConnected }] = await Promise.all([
        searchAvailability({ from: searchFrom, to, locationId: sqc.location_id!, variationId: svc.square_variation_id, teamMemberId: sqc.team_member_id }),
        busyRanges(from, to, { squareMode: true }),
      ]);
      for (const s of slots) {
        const start = new Date(s.start_at);
        const dur = s.appointment_segments.reduce((t, x) => t + x.duration_minutes, 0) || svc.duration_min;
        const end = new Date(start.getTime() + dur * 60000);
        if (start.getTime() < earliest) continue;
        if (busy.some((b) => b.start < end && b.end > start)) continue;
        const p = nyParts(start);
        if (!(p.dateKey in out) || p.dateKey > lastKey) continue;
        out[p.dateKey].push({ time: hhmm(p.minutes), label: fmtClock(p.minutes), startsAt: start.toISOString(), square: s });
      }
      for (const k of Object.keys(out)) out[k].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      return { service: svc, days: out, mode: 'square', googleConnected };
    } catch (e) {
      squareError = (e as Error).message;
      console.error('[availability] Square failed, falling back to local hours:', squareError);
    }
  }

  const { hours: hrs } = await getWeeklyHours();
  const { busy, googleConnected } = await busyRanges(from, to);
  for (const key of Object.keys(out)) {
    if (key < today || key > lastKey) continue;
    for (const h of hrs[dowOf(key)] || []) {
      const open = Math.round(h.open * 60);
      const close = Math.round(h.close * 60);
      for (let m = open; m + svc.duration_min <= close; m += SLOT_STEP) {
        const s = nyToUtc(key, m);
        const e = new Date(s.getTime() + svc.duration_min * 60000);
        if (s.getTime() < earliest) continue;
        if (busy.some((b) => b.start < e && b.end > s)) continue;
        out[key].push({ time: hhmm(m), label: fmtClock(m), startsAt: s.toISOString() });
      }
    }
  }
  return { service: svc, days: out, mode: 'local', googleConnected, squareError };
}
