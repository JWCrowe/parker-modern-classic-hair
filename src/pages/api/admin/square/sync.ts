import type { APIRoute } from 'astro';
import { syncSquareBookings } from '../../../../lib/square-sync';
import { bad, json, readJson } from '../../../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  const b = (await readJson(request)) || {};
  const full = b.full === true;
  const r = await syncSquareBookings(full ? { pastDays: 365, futureDays: 62 } : { pastDays: 31, futureDays: 62 });
  if ('skipped' in r) return bad('Square is not connected.', 409);
  return r.ok ? json(r) : bad(r.error, 502);
};
