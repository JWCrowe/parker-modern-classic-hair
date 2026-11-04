// Square is the source of truth for the public menu (services, prices, durations) and the posted hours.
// Neon keeps a synced copy so public pages render fast and still work if Square is briefly unreachable.
// Sync triggers: Connect Square, admin Sync now, Square webhooks, the daily cron, and a stale check on public page loads.
import { sql, getSetting, setSetting, deleteSetting, ensureSchema } from './db';
import { getSquareConn, getLocation, listServices, serviceOffered, type SquareService, type SquarePeriod } from './square';
import { fallbackHours } from '../data/site';
import { money } from './time';
import { fmtHour, type Period, type WeeklyHours } from './open-status';

export type { Period, WeeklyHours };


export type HoursCache = { location_id: string; timezone: string; days: WeeklyHours; synced_at: string };
export type CatalogCache = {
  synced_at?: string;
  attempted_at?: string;
  count?: number;
  hidden?: number;
  hours?: 'square' | 'not-set';
  error?: string | null;
};

export const CATALOG_KEY = 'square_catalog';
export const HOURS_KEY = 'square_hours';
const STALE_MS = 10 * 60000; // public pages refresh the copy when it is older than this
const RETRY_MS = 2 * 60000; // and do not hammer Square when a refresh just failed

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();

export function displayName(s: Pick<SquareService, 'itemName' | 'variationName' | 'variationCount'>) {
  const v = s.variationName.trim();
  return s.variationCount > 1 && v && v.toLowerCase() !== 'regular' ? `${s.itemName} (${v})` : s.itemName;
}

const DOW: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const dec = (t: string) => {
  const [h, m] = String(t || '0:0').split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
};

/** Square business hour periods to weekly hours. Returns null when Square has no hours posted. */
export function hoursFromPeriods(periods: SquarePeriod[]): WeeklyHours | null {
  if (!periods?.length) return null;
  const days: WeeklyHours = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const p of periods) {
    const d = DOW[p.day_of_week];
    if (d == null) continue;
    const open = dec(p.start_local_time);
    let close = dec(p.end_local_time);
    if (close <= open) close = 24; // runs to midnight
    days[d].push({ open, close });
  }
  for (const d of Object.keys(days)) days[Number(d)].sort((a, b) => a.open - b.open);
  return days;
}

/** Old single span shape ({ open, close } | null per day) to weekly hours. */
export function weeklyFromLegacy(h: Record<number, { open: number; close: number } | null> | null | undefined): WeeklyHours | null {
  if (!h || typeof h !== 'object') return null;
  const out: WeeklyHours = {};
  for (let d = 0; d < 7; d++) {
    const x = (h as any)[d];
    out[d] = x && typeof x.open === 'number' && typeof x.close === 'number' ? [{ open: x.open, close: x.close }] : [];
  }
  return out;
}

export type HoursSource = 'square' | 'admin' | 'default';

/** Square hours when synced, else the admin `hours` setting, else the defaults in site.ts. */
export async function getWeeklyHours(): Promise<{ hours: WeeklyHours; source: HoursSource }> {
  const sh = await getSetting<HoursCache>(HOURS_KEY).catch(() => null);
  if (sh?.days) return { hours: sh.days, source: 'square' };
  const admin = weeklyFromLegacy(await getSetting('hours').catch(() => null));
  if (admin) return { hours: admin, source: 'admin' };
  return { hours: weeklyFromLegacy(fallbackHours)!, source: 'default' };
}


const DAYS = [
  { idx: 1, day: 'Monday', short: 'Mon' },
  { idx: 2, day: 'Tuesday', short: 'Tue' },
  { idx: 3, day: 'Wednesday', short: 'Wed' },
  { idx: 4, day: 'Thursday', short: 'Thu' },
  { idx: 5, day: 'Friday', short: 'Fri' },
  { idx: 6, day: 'Saturday', short: 'Sat' },
  { idx: 0, day: 'Sunday', short: 'Sun' },
];

export function hoursRows(h: WeeklyHours) {
  return DAYS.map((d) => {
    const p = h[d.idx] || [];
    return { ...d, closed: !p.length, label: p.length ? p.map((x) => `${fmtHour(x.open)} – ${fmtHour(x.close)}`).join(', ') : 'Closed' };
  });
}

export function fmtDuration(m: number) {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min` : `${h} hr`;
}

/** Pull services and business hours from Square into Neon. Safe to call often. */
export async function syncSquareCatalog(): Promise<{ ok: true; services: SquareService[]; summary: string } | { ok: false; error: string; services: SquareService[] } | { skipped: true }> {
  const c = await getSquareConn().catch(() => null);
  if (!c?.access_token) return { skipped: true };
  const prev = (await getSetting<CatalogCache>(CATALOG_KEY).catch(() => null)) || {};
  const attempted_at = new Date().toISOString();
  await setSetting(CATALOG_KEY, { ...prev, attempted_at }).catch(() => {});
  try {
    await ensureSchema();
    const all = await listServices();
    const offered = all.filter((s) => serviceOffered(s, c.location_id, c.team_member_id)).sort((a, b) => displayName(a).localeCompare(displayName(b)));
    const q = sql();
    const rows = (await q`select id, name, square_variation_id, sort_order from services`) as { id: string; name: string; square_variation_id: string | null; sort_order: number }[];
    const byVar = new Map(rows.filter((r) => r.square_variation_id).map((r) => [r.square_variation_id!, r]));
    const claimed = new Set<string>();
    let maxSort = Math.max(0, ...rows.filter((r) => r.sort_order < 99).map((r) => Number(r.sort_order)));
    const live: string[] = [];
    for (const s of offered) {
      const name = displayName(s);
      let row = byVar.get(s.variationId);
      if (!row) {
        // First sync: reuse the matching original row (mens, beard, ...) so past visits stay linked.
        const n = norm(name);
        row = rows.find((r) => !r.square_variation_id && !claimed.has(r.id) && (norm(r.name) === n || norm(r.name) === norm(s.itemName)));
      }
      if (row) claimed.add(row.id);
      const id = row?.id ?? `sq_${s.variationId}`.slice(0, 60);
      const sort = row && Number(row.sort_order) < 99 ? Number(row.sort_order) : ++maxSort;
      await q`insert into services (id, name, description, duration_min, price_cents, active, sort_order, square_variation_id, square_variation_version, square_item_id, price_varies, synced_at)
        values (${id}, ${name}, ${s.description}, ${s.durationMin}, ${s.variablePrice ? 0 : s.priceCents}, true, ${sort}, ${s.variationId}, ${s.version}, ${s.itemId}, ${s.variablePrice}, now())
        on conflict (id) do update set
          name = excluded.name,
          description = excluded.description,
          duration_min = excluded.duration_min,
          price_cents = excluded.price_cents,
          active = true,
          sort_order = case when services.sort_order >= 99 then excluded.sort_order else services.sort_order end,
          square_variation_id = excluded.square_variation_id,
          square_variation_version = excluded.square_variation_version,
          square_item_id = excluded.square_item_id,
          price_varies = excluded.price_varies,
          synced_at = now()`;
      live.push(id);
    }
    // Anything Square no longer offers online leaves the public menu. Rows stay for visit history.
    if (live.length) await q`update services set active = false where active = true and not (id = any(${live}))`;
    else await q`update services set active = false where active = true and square_variation_id is not null`;

    let hoursState: CatalogCache['hours'] = 'not-set';
    if (c.location_id) {
      const loc = await getLocation(c.location_id);
      const days = hoursFromPeriods(loc.periods);
      if (days) {
        await setSetting(HOURS_KEY, { location_id: loc.id, timezone: loc.timezone, days, synced_at: attempted_at } satisfies HoursCache);
        hoursState = 'square';
      } else {
        await deleteSetting(HOURS_KEY);
      }
    }
    const summary = `${live.length} services live${all.length - offered.length ? `, ${all.length - offered.length} not bookable online` : ''}, hours ${hoursState === 'square' ? 'from Square' : 'not set in Square'}`;
    await setSetting(CATALOG_KEY, { synced_at: attempted_at, attempted_at, count: live.length, hidden: all.length - offered.length, hours: hoursState, error: null } satisfies CatalogCache);
    return { ok: true, services: all, summary };
  } catch (e) {
    const msg = (e as Error).message;
    console.error('[square catalog]', msg);
    await setSetting(CATALOG_KEY, { ...prev, attempted_at, error: msg }).catch(() => {});
    return { ok: false, error: msg, services: [] };
  }
}

/** Refresh the cached menu when it is stale. Waits at most `budgetMs` so a slow Square never stalls a page. */
export async function refreshCatalogIfStale(budgetMs = 3000) {
  const c = await getSquareConn().catch(() => null);
  if (!c?.access_token) return;
  const cat = await getSetting<CatalogCache>(CATALOG_KEY).catch(() => null);
  const synced = cat?.synced_at ? Date.parse(cat.synced_at) : 0;
  const tried = cat?.attempted_at ? Date.parse(cat.attempted_at) : 0;
  if (Date.now() - synced < STALE_MS || Date.now() - tried < RETRY_MS) return;
  await Promise.race([syncSquareCatalog().catch(() => {}), new Promise((r) => setTimeout(r, budgetMs))]);
}

export type PublicService = { id: string; name: string; desc: string; duration: number; time: string; price: string; priceCents: number };
export type PublicMenu = {
  mode: 'square' | 'local' | 'offline';
  services: PublicService[];
  hours: WeeklyHours;
  hoursSource: HoursSource;
  syncedAt: string | null;
};

/** What the public pages show. Square mode once a sync has brought services over; local mode before that. */
export async function getPublicMenu(): Promise<PublicMenu> {
  try {
    await ensureSchema().catch(() => {});
    await refreshCatalogIfStale();
    const [rows, cat, h] = await Promise.all([
      sql()`select id, name, description, duration_min, price_cents, coalesce(price_varies, false) as price_varies from services where active = true order by sort_order, name`.catch(
        () => sql()`select id, name, description, duration_min, price_cents, false as price_varies from services where active = true order by sort_order, name`
      ),
      getSetting<CatalogCache>(CATALOG_KEY).catch(() => null),
      getWeeklyHours(),
    ]);
    const services = rows.map((r: any) => ({
      id: r.id as string,
      name: r.name as string,
      desc: (r.description || '') as string,
      duration: Number(r.duration_min),
      time: fmtDuration(Number(r.duration_min)),
      priceCents: Number(r.price_cents),
      price: r.price_varies || !Number(r.price_cents) ? 'Ask' : money(r.price_cents),
    }));
    // Square mode keeps showing the last synced Square menu even if the connection drops.
    const mode = cat?.synced_at && cat.count ? 'square' : 'local';
    return { mode, services, hours: h.hours, hoursSource: h.source, syncedAt: cat?.synced_at || null };
  } catch (e) {
    console.error('[menu]', (e as Error).message);
    return { mode: 'offline', services: [], hours: weeklyFromLegacy(fallbackHours)!, hoursSource: 'default', syncedAt: null };
  }
}
