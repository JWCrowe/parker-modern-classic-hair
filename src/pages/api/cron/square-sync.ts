import type { APIRoute } from 'astro';
import { env } from '../../../lib/env';
import { bad, json } from '../../../lib/http';
import { syncSquareBookings } from '../../../lib/square-sync';

// Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
// Refreshes the public menu and hours from Square, then mirrors bookings.
export const GET: APIRoute = async ({ request }) => {
  const secret = env('CRON_SECRET');
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return bad('Unauthorized', 401);
  const r = await syncSquareBookings({ pastDays: 31, futureDays: 62 });
  return json(r);
};
