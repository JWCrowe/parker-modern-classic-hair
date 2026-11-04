// Square Appointments integration. Square is the source of truth for the schedule when connected.
// Docs: https://developer.squareup.com/docs/bookings-api/what-it-is
import { env } from './env';
import { getSetting, setSetting, deleteSetting } from './db';

export const SQUARE_VERSION = '2026-09-16';
export const SQUARE_KEY = 'square';

// Buyer-level writes work on the free Appointments plan. Seller-level writes (APPOINTMENTS_ALL_WRITE)
// need Appointments Plus or Premium, so they are opt in with SQUARE_SELLER_LEVEL_WRITES=true.
export function squareScopes() {
  const s = [
    'APPOINTMENTS_READ',
    'APPOINTMENTS_WRITE',
    'APPOINTMENTS_ALL_READ',
    'APPOINTMENTS_BUSINESS_SETTINGS_READ',
    'CUSTOMERS_READ',
    'CUSTOMERS_WRITE',
    'ITEMS_READ',
    'MERCHANT_PROFILE_READ',
    'EMPLOYEES_READ',
  ];
  if (env('SQUARE_SELLER_LEVEL_WRITES') === 'true') s.push('APPOINTMENTS_ALL_WRITE');
  return s;
}

export type SquareConn = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
  environment: 'sandbox' | 'production';
  location_id?: string;
  location_name?: string;
  team_member_id?: string;
  team_member_name?: string;
  booking_policy?: string;
  allow_user_cancel?: boolean;
  seller_level_writes?: boolean;
  connected_at?: string;
  last_sync_at?: string;
  last_full_sync_at?: string;
  last_sync_summary?: string;
  last_error?: string | null;
};

export function squareEnv(): 'sandbox' | 'production' {
  return env('SQUARE_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
}

export function squareBase() {
  return squareEnv() === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
}

export function squareDashboard() {
  return squareEnv() === 'production' ? 'https://app.squareup.com/appointments/calendar' : 'https://app.squareupsandbox.com/dashboard';
}

export function squareOAuthConfigured() {
  return Boolean(env('SQUARE_APPLICATION_ID') && env('SQUARE_APPLICATION_SECRET'));
}

export function squareRedirectUri(origin: string) {
  return env('SQUARE_REDIRECT_URI') || `${origin}/api/admin/square/callback`;
}

export function squareAuthUrl(origin: string, state: string) {
  const u = new URL(squareBase() + '/oauth2/authorize');
  u.searchParams.set('client_id', env('SQUARE_APPLICATION_ID')!);
  u.searchParams.set('scope', squareScopes().join(' '));
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', squareRedirectUri(origin));
  if (squareEnv() === 'production') u.searchParams.set('session', 'false');
  return u.toString();
}

export class SquareError extends Error {
  status: number;
  errors: any[];
  constructor(status: number, errors: any[] = []) {
    super(errors.map((e) => e.detail || e.code).join('; ') || `Square HTTP ${status}`);
    this.status = status;
    this.errors = errors;
  }
  get code() {
    return this.errors[0]?.code as string | undefined;
  }
}

async function call(token: string, path: string, init: { method?: string; body?: unknown; query?: Record<string, string | undefined> } = {}) {
  const u = new URL(squareBase() + path);
  for (const [k, v] of Object.entries(init.query || {})) if (v != null) u.searchParams.set(k, v);
  const res = await fetch(u, {
    method: init.method || (init.body ? 'POST' : 'GET'),
    headers: { 'Square-Version': SQUARE_VERSION, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new SquareError(res.status, data.errors);
  return data;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(squareBase() + '/oauth2/token', {
    method: 'POST',
    headers: { 'Square-Version': SQUARE_VERSION, 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env('SQUARE_APPLICATION_ID'), client_secret: env('SQUARE_APPLICATION_SECRET'), ...body }),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new SquareError(res.status, data.errors || [{ detail: data.message || data.error_description || 'Token exchange failed' }]);
  return data as { access_token: string; refresh_token?: string; expires_at?: string; merchant_id?: string };
}

export async function exchangeSquareCode(origin: string, code: string) {
  const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: squareRedirectUri(origin) });
  const prev = (await getSetting<SquareConn>(SQUARE_KEY)) || ({} as SquareConn);
  const conn: SquareConn = {
    ...prev,
    access_token: t.access_token,
    refresh_token: t.refresh_token || prev.refresh_token,
    expires_at: t.expires_at,
    merchant_id: t.merchant_id,
    environment: squareEnv(),
    connected_at: new Date().toISOString(),
    last_error: null,
  };
  await setSetting(SQUARE_KEY, conn);
  await autoConfigure();
  return conn;
}

export async function getSquareConn(): Promise<SquareConn | null> {
  const c = await getSetting<SquareConn>(SQUARE_KEY).catch(() => null);
  const envToken = env('SQUARE_ACCESS_TOKEN');
  if (envToken) {
    // Personal access token mode (handy for Sandbox testing). Location and team choices still live in settings.
    return { ...(c || {}), access_token: envToken, environment: squareEnv(), location_id: c?.location_id || env('SQUARE_LOCATION_ID'), team_member_id: c?.team_member_id || env('SQUARE_TEAM_MEMBER_ID') } as SquareConn;
  }
  if (!c?.access_token) return null;
  return { ...c, location_id: c.location_id || env('SQUARE_LOCATION_ID'), team_member_id: c.team_member_id || env('SQUARE_TEAM_MEMBER_ID') };
}

export async function updateSquareConn(patch: Partial<SquareConn>) {
  const c = (await getSetting<SquareConn>(SQUARE_KEY)) || ({ environment: squareEnv() } as SquareConn);
  await setSetting(SQUARE_KEY, { ...c, ...patch });
}

/** Valid access token, refreshed when it is within 7 days of expiring (Square tokens last 30 days). */
export async function squareToken(): Promise<string | null> {
  const envToken = env('SQUARE_ACCESS_TOKEN');
  if (envToken) return envToken;
  const c = await getSetting<SquareConn>(SQUARE_KEY).catch(() => null);
  if (!c?.access_token) return null;
  const exp = c.expires_at ? Date.parse(c.expires_at) : 0;
  if (exp && exp - Date.now() < 7 * 86400000 && c.refresh_token && squareOAuthConfigured()) {
    try {
      const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
      await setSetting(SQUARE_KEY, { ...c, access_token: t.access_token, refresh_token: t.refresh_token || c.refresh_token, expires_at: t.expires_at, last_error: null });
      return t.access_token;
    } catch (e) {
      console.error('[square] refresh failed', (e as Error).message);
      await setSetting(SQUARE_KEY, { ...c, last_error: `Token refresh failed: ${(e as Error).message}` });
      if (exp > Date.now()) return c.access_token;
      return null;
    }
  }
  return c.access_token;
}

export async function sq(path: string, init?: Parameters<typeof call>[2]) {
  const t = await squareToken();
  if (!t) throw new SquareError(401, [{ detail: 'Square is not connected' }]);
  return call(t, path, init);
}

/** Square is live for public booking when connected with a location and the service is mapped. */
export async function squareReady() {
  const c = await getSquareConn();
  return c && c.access_token && c.location_id ? c : null;
}

export async function disconnectSquare() {
  const c = await getSetting<SquareConn>(SQUARE_KEY);
  if (c?.access_token && squareOAuthConfigured()) {
    try {
      await fetch(squareBase() + '/oauth2/revoke', {
        method: 'POST',
        headers: { 'Square-Version': SQUARE_VERSION, 'Content-Type': 'application/json', Authorization: `Client ${env('SQUARE_APPLICATION_SECRET')}` },
        body: JSON.stringify({ client_id: env('SQUARE_APPLICATION_ID'), access_token: c.access_token }),
      });
    } catch (e) {
      console.warn('[square] revoke failed (continuing)', (e as Error).message);
    }
  }
  await deleteSetting(SQUARE_KEY);
}

// ---------- Reads ----------

export async function listLocations() {
  const d = await sq('/v2/locations');
  return (d.locations || []).filter((l: any) => l.status === 'ACTIVE').map((l: any) => ({ id: l.id as string, name: l.name as string, timezone: l.timezone as string }));
}

export async function listTeam() {
  const out: { id: string; name: string }[] = [];
  let cursor: string | undefined;
  do {
    const d = await sq('/v2/bookings/team-member-booking-profiles', { query: { bookable_only: 'true', limit: '100', cursor } });
    for (const p of d.team_member_booking_profiles || []) out.push({ id: p.team_member_id, name: p.display_name || p.team_member_id });
    cursor = d.cursor;
  } while (cursor);
  return out;
}

export async function businessProfile() {
  const d = await sq('/v2/bookings/business-booking-profile');
  return d.business_booking_profile || {};
}

export type SquareService = {
  variationId: string;
  version: number;
  itemId: string;
  itemName: string;
  variationName: string;
  variationCount: number;
  description: string;
  durationMin: number;
  priceCents: number;
  variablePrice: boolean;
  bookable: boolean;
  teamMemberIds: string[];
  presence: Presence[];
};

type Presence = { all: boolean; present: string[]; absent: string[] };
const presenceOf = (o: any): Presence => ({ all: o?.present_at_all_locations !== false, present: o?.present_at_location_ids || [], absent: o?.absent_at_location_ids || [] });
const presentAt = (p: Presence, loc: string) => (p.all ? !p.absent.includes(loc) : p.present.includes(loc));

/** Every appointment service variation in the Square catalog (archived items are excluded by Square). */
export async function listServices(): Promise<SquareService[]> {
  const out: SquareService[] = [];
  let cursor: string | undefined;
  do {
    const d = await sq('/v2/catalog/search-catalog-items', { body: { product_types: ['APPOINTMENTS_SERVICE'], limit: 100, cursor } });
    for (const item of d.items || []) {
      const idata = item.item_data || {};
      if (idata.is_archived) continue;
      const vars = idata.variations || [];
      for (const v of vars) {
        if (v.is_deleted) continue;
        const vd = v.item_variation_data || {};
        out.push({
          variationId: v.id,
          version: Number(v.version),
          itemId: item.id,
          itemName: idata.name || '',
          variationName: vd.name || '',
          variationCount: vars.length,
          description: String(idata.description_plaintext || idata.description || '').trim(),
          durationMin: Math.round(Number(vd.service_duration || 0) / 60000),
          priceCents: Number(vd.price_money?.amount || 0),
          variablePrice: vd.pricing_type === 'VARIABLE_PRICING' || !vd.price_money,
          bookable: vd.available_for_booking !== false,
          teamMemberIds: vd.team_member_ids || [],
          // A variation is only offered where both the item and the variation are present.
          presence: [presenceOf(item), presenceOf(v)],
        });
      }
    }
    cursor = d.cursor;
  } while (cursor);
  return out;
}

/** True when this variation can be booked online at the location (and by the chosen barber, when one is set). */
export function serviceOffered(s: SquareService, locationId?: string, teamMemberId?: string) {
  if (!s.bookable || !s.durationMin) return false;
  if (locationId && !s.presence.every((p) => presentAt(p, locationId))) return false;
  if (teamMemberId && s.teamMemberIds.length && !s.teamMemberIds.includes(teamMemberId)) return false;
  return true;
}

export type SquarePeriod = { day_of_week: string; start_local_time: string; end_local_time: string };

/** One location with its posted business hours (Square Dashboard: Account and Settings, Locations, Business hours). */
export async function getLocation(id: string) {
  const d = await sq(`/v2/locations/${id}`);
  const l = d.location || {};
  return {
    id: l.id as string,
    name: (l.name || '') as string,
    timezone: (l.timezone || 'America/New_York') as string,
    periods: (l.business_hours?.periods || []) as SquarePeriod[],
  };
}

export type SquareSlot = { start_at: string; location_id: string; appointment_segments: { duration_minutes: number; team_member_id: string; service_variation_id: string; service_variation_version: number }[] };

/** SearchAvailability. Square requires a range of at least 24 hours and at most 31 days, so long ranges are chunked. */
export async function searchAvailability(opts: { from: Date; to: Date; locationId: string; variationId: string; teamMemberId?: string }) {
  const out: SquareSlot[] = [];
  const DAY = 86400000;
  let start = opts.from.getTime();
  const end = Math.max(opts.to.getTime(), start + DAY);
  while (start < end) {
    const chunkEnd = Math.min(end, start + 31 * DAY);
    const realEnd = Math.max(chunkEnd, start + DAY);
    const d = await sq('/v2/bookings/availability/search', {
      body: {
        query: {
          filter: {
            start_at_range: { start_at: new Date(start).toISOString(), end_at: new Date(realEnd).toISOString() },
            location_id: opts.locationId,
            segment_filters: [{ service_variation_id: opts.variationId, ...(opts.teamMemberId ? { team_member_id_filter: { any: [opts.teamMemberId] } } : {}) }],
          },
        },
      },
    });
    out.push(...(d.availabilities || []));
    start = chunkEnd;
  }
  return out;
}

export async function findCustomer(email: string | null, phoneE164: string | null) {
  for (const filter of [email ? { email_address: { exact: email } } : null, phoneE164 ? { phone_number: { exact: phoneE164 } } : null]) {
    if (!filter) continue;
    const d = await sq('/v2/customers/search', { body: { query: { filter }, limit: 1 } });
    if (d.customers?.[0]) return d.customers[0];
  }
  return null;
}

export async function createCustomer(c: { name: string; email: string | null; phoneE164: string }) {
  const [given, ...rest] = c.name.split(/\s+/);
  const d = await sq('/v2/customers', {
    body: { idempotency_key: crypto.randomUUID(), given_name: given, family_name: rest.join(' ') || undefined, email_address: c.email || undefined, phone_number: c.phoneE164, note: 'Created by parkermodernclassichair.com booking' },
  });
  return d.customer;
}

export async function getCustomers(ids: string[]) {
  const map: Record<string, any> = {};
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    try {
      const d = await sq('/v2/customers/bulk-retrieve', { body: { customer_ids: chunk } });
      for (const [id, r] of Object.entries<any>(d.responses || {})) if (r.customer) map[id] = r.customer;
    } catch {
      for (const id of chunk) {
        try {
          map[id] = (await sq(`/v2/customers/${id}`)).customer;
        } catch {}
      }
    }
  }
  return map;
}

export async function createBooking(b: { slot: SquareSlot; customerId: string; note: string }) {
  const d = await sq('/v2/bookings', {
    body: {
      idempotency_key: crypto.randomUUID(),
      booking: {
        start_at: b.slot.start_at,
        location_id: b.slot.location_id,
        customer_id: b.customerId,
        customer_note: b.note || undefined,
        appointment_segments: b.slot.appointment_segments.map((s) => ({
          team_member_id: s.team_member_id,
          service_variation_id: s.service_variation_id,
          service_variation_version: s.service_variation_version,
          duration_minutes: s.duration_minutes,
        })),
      },
    },
  });
  return d.booking;
}

export async function retrieveBooking(id: string) {
  return (await sq(`/v2/bookings/${id}`)).booking;
}

export async function cancelBooking(id: string) {
  const cur = await retrieveBooking(id);
  const d = await sq(`/v2/bookings/${id}/cancel`, { body: { idempotency_key: crypto.randomUUID(), booking_version: cur.version } });
  return d.booking;
}

export async function listBookings(opts: { from: Date; to: Date; locationId?: string }) {
  const out: any[] = [];
  const DAY = 86400000;
  let start = opts.from.getTime();
  const end = opts.to.getTime();
  while (start < end) {
    const chunkEnd = Math.min(end, start + 31 * DAY);
    let cursor: string | undefined;
    do {
      const d = await sq('/v2/bookings', {
        query: { location_id: opts.locationId, start_at_min: new Date(start).toISOString(), start_at_max: new Date(chunkEnd).toISOString(), limit: '100', cursor },
      });
      out.push(...(d.bookings || []));
      cursor = d.cursor;
    } while (cursor);
    start = chunkEnd;
  }
  return out;
}

/** After connecting: pick the only location / team member automatically and read the booking policy. */
export async function autoConfigure() {
  const c = await getSquareConn();
  if (!c) return;
  const patch: Partial<SquareConn> = {};
  try {
    const locs = await listLocations();
    if (!c.location_id && locs.length >= 1) {
      patch.location_id = locs[0].id;
      patch.location_name = locs[0].name;
    }
    const team = await listTeam();
    if (!c.team_member_id && team.length === 1) {
      patch.team_member_id = team[0].id;
      patch.team_member_name = team[0].name;
    }
    const p = await businessProfile();
    patch.booking_policy = p.booking_policy;
    patch.allow_user_cancel = p.allow_user_cancel;
    patch.seller_level_writes = p.support_seller_level_writes;
  } catch (e) {
    patch.last_error = (e as Error).message;
  }
  await updateSquareConn(patch);
}

export function toE164(phone: string) {
  const d = phone.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return d ? `+${d}` : '';
}

export function mapSquareStatus(s: string): 'inquiry' | 'confirmed' | 'cancelled' | 'no_show' {
  switch (s) {
    case 'PENDING':
      return 'inquiry';
    case 'ACCEPTED':
      return 'confirmed';
    case 'NO_SHOW':
      return 'no_show';
    default:
      return 'cancelled'; // CANCELLED_BY_CUSTOMER, CANCELLED_BY_SELLER, DECLINED
  }
}
