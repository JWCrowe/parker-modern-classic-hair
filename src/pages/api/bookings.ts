import type { APIRoute } from 'astro';
import { availability } from '../../lib/availability';
import { upsertClient } from '../../lib/clients';
import { sql } from '../../lib/db';
import { bad, json, normPhone, readJson, str } from '../../lib/http';
import { isDateKey, nyToUtc, parseHHMM } from '../../lib/time';
import { createBooking, createCustomer, findCustomer, mapSquareStatus, SquareError, toE164 } from '../../lib/square';
import { notifyNewBooking, getAppointment } from '../../lib/appointments';

// POST /api/bookings { service, date: YYYY-MM-DD, time: HH:MM, name, phone, email?, notes? }
export const POST: APIRoute = async ({ request, url }) => {
  const b = await readJson(request);
  if (!b) return bad('Send JSON.');
  if (str(b.website)) return json({ ok: true, status: 'inquiry' }); // honeypot
  const service = str(b.service, 60);
  const date = b.date;
  const minutes = parseHHMM(b.time);
  const name = str(b.name, 120);
  const phone = str(b.phone, 40);
  const email = str(b.email, 200).toLowerCase();
  const notes = str(b.notes, 1000);
  if (!service || !isDateKey(date) || minutes == null) return bad('Pick a service, date, and time.');
  if (!name) return bad('Add your name so Ben knows who is coming in.');
  if (normPhone(phone).length !== 10) return bad('Add a 10 digit phone number Ben can reach you at.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('That email does not look right.');

  try {
    const startsAt = nyToUtc(date, minutes);
    const av = await availability(service, date, 1);
    if (!av) return bad('Unknown service.', 404);
    const slot = av.days[date]?.find((s) => s.startsAt === startsAt.toISOString());
    if (!slot) return bad('That time was just taken. Pick another one.', 409);

    const client = await upsertClient({ name, email: email || null, phone });
    const duration = slot.square ? slot.square.appointment_segments.reduce((t, s) => t + s.duration_minutes, 0) : av.service.duration_min;
    const endsAt = new Date(startsAt.getTime() + duration * 60000);

    let square: { id: string; version: number; status: string; team: string | null } | null = null;
    let fallbackNote = '';
    if (av.mode === 'square' && slot.square) {
      try {
        let customerId: string | null = client.square_customer_id;
        if (!customerId) {
          const found = await findCustomer(email || null, toE164(phone));
          customerId = found?.id || (await createCustomer({ name, email: email || null, phoneE164: toE164(phone) })).id;
          await sql()`update clients set square_customer_id = ${customerId} where id = ${client.id} and square_customer_id is null`;
        }
        const bk = await createBooking({ slot: slot.square, customerId: customerId!, note: notes });
        square = { id: bk.id, version: bk.version, status: bk.status, team: slot.square.appointment_segments[0]?.team_member_id || null };
      } catch (e) {
        const msg = (e as Error).message;
        console.error('[bookings] Square create failed:', msg);
        if (e instanceof SquareError && e.status < 500 && /avail|conflict|taken|slot/i.test(msg)) return bad('That time was just taken. Pick another one.', 409);
        fallbackNote = `[Saved locally: Square booking failed (${msg.slice(0, 160)}). Add it in Square if you confirm.]`;
      }
    }

    const status = square ? mapSquareStatus(square.status) : 'inquiry';
    const rows = await sql()`insert into appointments (client_id, service_id, starts_at, ends_at, status, price_cents, notes, source, square_booking_id, square_version, square_status, team_member_id)
      values (${client.id}, ${av.service.id}, ${startsAt.toISOString()}, ${endsAt.toISOString()}, ${status}, ${av.service.price_cents},
        ${[notes, fallbackNote].filter(Boolean).join('\n')}, 'web', ${square?.id || null}, ${square?.version ?? null}, ${square?.status || null}, ${square?.team || null})
      returning id`;
    const appt = await getAppointment(rows[0].id);
    const mail = await notifyNewBooking(appt, url.origin);
    return json({ ok: true, id: appt.id, status, via: square ? 'square' : 'local', emailed: mail }, 201);
  } catch (e) {
    console.error('[bookings]', (e as Error).message);
    return bad('Something went wrong saving your request. Text or call Ben.', 500);
  }
};
