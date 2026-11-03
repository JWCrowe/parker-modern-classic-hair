import { sql } from './db';
import { sendMail, adminNotifyEmail } from './email';
import { upsertEvent, deleteEvent } from './google';
import { fmtDateTime, money } from './time';
import { fmtPhone, siteUrl } from './http';
import { business } from '../data/site';
import { cancelBooking, mapSquareStatus, squareDashboard } from './square';

export const STATUSES = ['inquiry', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
export type Status = (typeof STATUSES)[number];

export async function getAppointment(id: string) {
  const rows = await sql()`select a.*, s.name as service_name, s.duration_min, c.name as client_name, c.email as client_email, c.phone as client_phone
    from appointments a join services s on s.id = a.service_id join clients c on c.id = a.client_id where a.id = ${id}`;
  return rows[0] as any;
}

function eventFor(a: any) {
  return {
    summary: `${a.service_name}: ${a.client_name}`,
    description: [`Client: ${a.client_name}`, a.client_phone ? `Phone: ${fmtPhone(a.client_phone)}` : '', a.client_email ? `Email: ${a.client_email}` : '', `Price: ${money(a.price_cents)}`, a.notes ? `Notes: ${a.notes}` : '', 'Booked via parkermodernclassichair.com']
      .filter(Boolean)
      .join('\n'),
    start: new Date(a.starts_at),
    end: new Date(a.ends_at),
  };
}

/** Move an appointment to a new status and run side effects (Google event, client email). */
export async function setStatus(id: string, status: Status, opts: { notify?: boolean; origin?: string } = {}) {
  const a = await getAppointment(id);
  if (!a) return { error: 'Not found' as const };
  const notify = opts.notify !== false;
  const base = siteUrl(opts.origin);
  let googleEventId: string | null = a.google_event_id;
  let emailed = false;
  const isSquare = Boolean(a.square_booking_id);
  let squareStatus: string | null = a.square_status;

  if (isSquare && status === 'confirmed' && a.square_status === 'PENDING') {
    // Square does not let apps accept a pending request; Ben accepts it in Square and the sync picks it up.
    return { error: `This request is pending in Square. Accept it in the Square app or dashboard (${squareDashboard()}), then it will show as confirmed here.` };
  }
  if (isSquare && status === 'cancelled' && ['PENDING', 'ACCEPTED'].includes(a.square_status)) {
    try {
      const b = await cancelBooking(a.square_booking_id);
      squareStatus = b?.status || 'CANCELLED_BY_SELLER';
      if (mapSquareStatus(squareStatus!) !== 'cancelled') throw new Error(`Square returned ${squareStatus}`);
    } catch (e) {
      return { error: `Square would not cancel this booking (${(e as Error).message}). Cancel it in the Square app; it will sync here.` };
    }
  }

  if (status === 'confirmed') {
    // Square bookings live on Square's calendar (Square can sync to Google itself), so only local ones get a Google event.
    if (!isSquare) googleEventId = (await upsertEvent(eventFor(a), a.google_event_id)) || a.google_event_id;
    if (notify && a.client_email) {
      const r = await sendMail({
        to: a.client_email,
        replyTo: business.email,
        subject: `You're booked: ${a.service_name}, ${fmtDateTime(a.starts_at)}`,
        heading: "You're booked",
        intro: `Ben confirmed your appointment. See you at the chair.`,
        lines: [['Service', a.service_name], ['When', fmtDateTime(a.starts_at)], ['Price', money(a.price_cents)], ['Where', `${business.street}, ${business.city}`]],
        cta: { label: 'Get directions', href: business.mapsHref },
      });
      emailed = r.ok;
    }
  }

  if (status === 'cancelled') {
    await deleteEvent(a.google_event_id);
    googleEventId = null;
    if (notify && a.client_email) {
      const wasInquiry = a.status === 'inquiry';
      const r = await sendMail({
        to: a.client_email,
        replyTo: business.email,
        subject: wasInquiry ? `About your request for ${fmtDateTime(a.starts_at)}` : `Appointment cancelled: ${fmtDateTime(a.starts_at)}`,
        heading: wasInquiry ? 'That time did not work' : 'Appointment cancelled',
        intro: wasInquiry
          ? `Ben could not take this request. Pick another time online or text him at ${business.phone}.`
          : `Your appointment has been cancelled. Book a new time online or text Ben at ${business.phone}.`,
        lines: [['Service', a.service_name], ['Requested', fmtDateTime(a.starts_at)]],
        cta: { label: 'Pick another time', href: `${base}/book?service=${a.service_id}` },
      });
      emailed = r.ok;
    }
  }

  await sql()`update appointments set status = ${status}, google_event_id = ${googleEventId}, square_status = ${squareStatus}, updated_at = now() where id = ${id}`;
  return { ok: true as const, emailed, googleEventId };
}

export async function notifyNewBooking(a: any, origin?: string) {
  const base = siteUrl(origin);
  const when = fmtDateTime(a.starts_at);
  const booked = a.status === 'confirmed';
  const adminMail = sendMail({
    to: adminNotifyEmail(),
    replyTo: a.client_email || undefined,
    subject: `${booked ? 'New booking' : 'New booking request'}: ${a.client_name}, ${when}`,
    heading: booked ? 'New booking' : 'New booking request',
    intro: booked
      ? 'Square accepted this booking automatically. It is on your calendar.'
      : a.square_booking_id
        ? 'This request is pending in Square. Accept or decline it in the Square app.'
        : 'Confirm or decline it in the admin panel.',
    lines: [['Client', a.client_name], ['Phone', fmtPhone(a.client_phone)], ['Email', a.client_email || 'Not given'], ['Service', a.service_name], ['When', when], ['Price', money(a.price_cents)], ['Notes', a.notes || 'None'], ['Booked through', a.square_booking_id ? 'Square' : 'Website (local)']],
    cta: { label: booked ? 'Open calendar' : 'Open inquiries', href: `${base}/admin/${booked ? 'calendar' : 'inquiries'}` },
  });
  const first = String(a.client_name).split(' ')[0];
  const clientMail = a.client_email
    ? sendMail({
        to: a.client_email,
        replyTo: business.email,
        subject: booked ? `You're booked: ${a.service_name}, ${when}` : `Request received: ${a.service_name}, ${when}`,
        heading: booked ? "You're booked" : 'Request received',
        intro: booked
          ? `Thanks, ${first}. Your time with Ben is locked in. Need to change it? Text ${business.phone}.`
          : `Thanks, ${first}. Ben confirms every appointment personally. You will get another message once he locks it in.`,
        lines: [['Service', a.service_name], [booked ? 'When' : 'Requested', when], ['Price', money(a.price_cents)], ['Status', booked ? 'Confirmed' : 'Waiting on Ben']],
        cta: booked ? { label: 'Get directions', href: business.mapsHref } : undefined,
      })
    : Promise.resolve({ ok: true });
  const [x, y] = await Promise.all([adminMail, clientMail]);
  return { admin: x.ok, client: y.ok };
}
