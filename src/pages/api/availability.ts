import type { APIRoute } from 'astro';
import { availability, HORIZON_DAYS } from '../../lib/availability';
import { bad, json } from '../../lib/http';
import { isDateKey, todayKey } from '../../lib/time';

// GET /api/availability?date=YYYY-MM-DD&service=mens        -> { date, slots: [...] }
// GET /api/availability?start=YYYY-MM-DD&days=14&service=mens -> { days: [{ date, count }] }
export const GET: APIRoute = async ({ url }) => {
  const service = url.searchParams.get('service') || '';
  const date = url.searchParams.get('date');
  const start = url.searchParams.get('start') || todayKey();
  if (!service) return bad('service is required');
  try {
    if (date) {
      if (!isDateKey(date)) return bad('date must be YYYY-MM-DD');
      const r = await availability(service, date, 1);
      if (!r) return bad('Unknown service', 404);
      const slots = (r.days[date] || []).map(({ time, label, startsAt }) => ({ time, label, startsAt }));
      return json({ date, service: r.service.id, mode: r.mode, slots }, 200, { 'cache-control': 'no-store' });
    }
    if (!isDateKey(start)) return bad('start must be YYYY-MM-DD');
    const days = Math.min(Math.max(Number(url.searchParams.get('days') || 14), 1), HORIZON_DAYS);
    const r = await availability(service, start, days);
    if (!r) return bad('Unknown service', 404);
    return json({ service: r.service.id, mode: r.mode, days: Object.entries(r.days).map(([d, s]) => ({ date: d, count: s.length })) });
  } catch (e) {
    console.error('[availability]', (e as Error).message);
    return bad('Could not load times right now. Call or text Ben.', 500);
  }
};
