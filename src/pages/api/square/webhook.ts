import type { APIRoute } from 'astro';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../../lib/env';
import { bad, json } from '../../../lib/http';
import { syncSquareCatalog } from '../../../lib/catalog';
import { syncSquareBookings } from '../../../lib/square-sync';

// Square webhook. Subscribe in the Square Developer Dashboard (Webhooks) to:
//   catalog.version.updated  (services, prices, durations added, changed, or removed)
//   location.updated         (business hours)
//   booking.created, booking.updated
// Set SQUARE_WEBHOOK_SIGNATURE_KEY in Vercel. SQUARE_WEBHOOK_URL must match the URL registered in Square
// (defaults to this request's URL).
export const POST: APIRoute = async ({ request, url }) => {
  const key = env('SQUARE_WEBHOOK_SIGNATURE_KEY');
  if (!key) return bad('Webhook not configured', 503);
  const body = await request.text();
  const notificationUrl = env('SQUARE_WEBHOOK_URL') || `${url.origin}${url.pathname}`;
  const expected = createHmac('sha256', key).update(notificationUrl + body).digest('base64');
  const got = request.headers.get('x-square-hmacsha256-signature') || '';
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return bad('Bad signature', 401);

  let type = '';
  try {
    type = String(JSON.parse(body).type || '');
  } catch {
    return bad('Bad JSON');
  }
  if (type.startsWith('booking.')) {
    // Bookings sync also refreshes the menu and hours first.
    const r = await syncSquareBookings({ pastDays: 2, futureDays: 62 });
    return json({ ok: true, type, result: 'ok' in r ? r.ok : 'skipped' });
  }
  if (type.startsWith('catalog.') || type.startsWith('location.') || type.startsWith('team_member.') || type.startsWith('booking_')) {
    const r = await syncSquareCatalog();
    return json({ ok: true, type, result: 'ok' in r ? r.ok : 'skipped' });
  }
  return json({ ok: true, type, ignored: true });
};
