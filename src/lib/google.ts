import { google } from 'googleapis';
import { env } from './env';
import { getSetting, setSetting, deleteSetting } from './db';
import { TZ } from './time';

export const GOOGLE_KEY = 'google_calendar';
export const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy',
];

export type GoogleConn = {
  refresh_token: string;
  email?: string;
  calendar_id: string;
  connected_at: string;
  last_error?: string | null;
};

export function googleConfigured() {
  return Boolean(env('GOOGLE_CLIENT_ID') && env('GOOGLE_CLIENT_SECRET'));
}

export function redirectUri(origin: string) {
  return env('GOOGLE_REDIRECT_URI') || `${origin}/api/admin/google/callback`;
}

export function oauthClient(origin: string) {
  return new google.auth.OAuth2(env('GOOGLE_CLIENT_ID'), env('GOOGLE_CLIENT_SECRET'), redirectUri(origin));
}

export function authUrl(origin: string, state: string) {
  return oauthClient(origin).generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: SCOPES,
    state,
  });
}

export async function exchangeCode(origin: string, code: string) {
  const client = oauthClient(origin);
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and connect again.');
  let email: string | undefined;
  if (tokens.id_token) {
    try {
      const payload = JSON.parse(Buffer.from(tokens.id_token.split('.')[1], 'base64url').toString('utf8'));
      email = payload.email;
    } catch {}
  }
  const conn: GoogleConn = { refresh_token: tokens.refresh_token, email, calendar_id: 'primary', connected_at: new Date().toISOString(), last_error: null };
  await setSetting(GOOGLE_KEY, conn);
  return conn;
}

export async function getConnection(): Promise<GoogleConn | null> {
  const c = await getSetting<GoogleConn>(GOOGLE_KEY);
  return c && c.refresh_token ? c : null;
}

export async function disconnect(origin: string) {
  const c = await getConnection();
  if (c) {
    try {
      await oauthClient(origin).revokeToken(c.refresh_token);
    } catch (e) {
      console.warn('[google] revoke failed (continuing):', (e as Error).message);
    }
  }
  await deleteSetting(GOOGLE_KEY);
}

async function calendarApi(origin = env('PUBLIC_SITE_URL') || 'http://localhost:4321') {
  if (!googleConfigured()) return null;
  const c = await getConnection();
  if (!c) return null;
  const auth = oauthClient(origin);
  auth.setCredentials({ refresh_token: c.refresh_token });
  return { cal: google.calendar({ version: 'v3', auth }), conn: c };
}

async function noteError(conn: GoogleConn, err: unknown) {
  const msg = (err as any)?.response?.data?.error_description || (err as Error)?.message || String(err);
  console.error('[google]', msg);
  try {
    await setSetting(GOOGLE_KEY, { ...conn, last_error: `${new Date().toISOString()} ${msg}` });
  } catch {}
}

export type Busy = { start: Date; end: Date };

/** Busy ranges from Ben's Google Calendar. Returns [] when not connected or on error (never fakes data). */
export async function freeBusy(from: Date, to: Date): Promise<{ busy: Busy[]; connected: boolean; error?: string }> {
  const api = await calendarApi();
  if (!api) return { busy: [], connected: false };
  try {
    const res = await api.cal.freebusy.query({
      requestBody: { timeMin: from.toISOString(), timeMax: to.toISOString(), timeZone: TZ, items: [{ id: api.conn.calendar_id }] },
    });
    const cal = res.data.calendars?.[api.conn.calendar_id];
    const busy = (cal?.busy || []).map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
    if (api.conn.last_error) await setSetting(GOOGLE_KEY, { ...api.conn, last_error: null });
    return { busy, connected: true };
  } catch (e) {
    await noteError(api.conn, e);
    return { busy: [], connected: true, error: (e as Error).message };
  }
}

export type EventInput = { summary: string; description?: string; start: Date; end: Date; allDay?: { startKey: string; endKey: string } };

export async function upsertEvent(input: EventInput, existingId?: string | null): Promise<string | null> {
  const api = await calendarApi();
  if (!api) return null;
  const requestBody = {
    summary: input.summary,
    description: input.description,
    location: '111 S Wall St Ste B, Calhoun, GA 30701',
    start: input.allDay ? { date: input.allDay.startKey } : { dateTime: input.start.toISOString(), timeZone: TZ },
    end: input.allDay ? { date: input.allDay.endKey } : { dateTime: input.end.toISOString(), timeZone: TZ },
    transparency: 'opaque',
  };
  try {
    if (existingId) {
      const r = await api.cal.events.update({ calendarId: api.conn.calendar_id, eventId: existingId, requestBody });
      return r.data.id || existingId;
    }
    const r = await api.cal.events.insert({ calendarId: api.conn.calendar_id, requestBody });
    return r.data.id || null;
  } catch (e) {
    await noteError(api.conn, e);
    return null;
  }
}

export async function deleteEvent(eventId: string | null | undefined) {
  if (!eventId) return;
  const api = await calendarApi();
  if (!api) return;
  try {
    await api.cal.events.delete({ calendarId: api.conn.calendar_id, eventId });
  } catch (e: any) {
    if (e?.code === 404 || e?.code === 410) return;
    await noteError(api.conn, e);
  }
}
