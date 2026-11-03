import { sql } from './db';
import { upsertEvent, deleteEvent } from './google';
import { addDays, isDateKey, nyToUtc, parseHHMM } from './time';
import { str } from './http';

export type BlockInput = { allDay: boolean; startDate: string; endDate?: string; startTime?: string; endTime?: string; title?: string; notes?: string; syncGoogle?: boolean };

/** Validate UI input into a real range. All day blocks run midnight to midnight NY, endDate inclusive. */
export function parseBlock(body: any): { error: string } | { startsAt: Date; endsAt: Date; allDay: boolean; title: string; notes: string; startKey: string; endKeyExclusive: string; syncGoogle: boolean } {
  const allDay = Boolean(body?.allDay);
  const startDate = body?.startDate;
  const endDate = body?.endDate || startDate;
  if (!isDateKey(startDate) || !isDateKey(endDate)) return { error: 'Pick a valid date.' };
  if (endDate < startDate) return { error: 'End date is before start date.' };
  const title = str(body?.title, 80);
  const notes = str(body?.notes, 1000);
  const syncGoogle = body?.syncGoogle !== false;
  if (allDay) {
    const endKeyExclusive = addDays(endDate, 1);
    return { startsAt: nyToUtc(startDate, 0), endsAt: nyToUtc(endKeyExclusive, 0), allDay, title, notes, startKey: startDate, endKeyExclusive, syncGoogle };
  }
  const s = parseHHMM(body?.startTime);
  const e = parseHHMM(body?.endTime);
  if (s == null || e == null) return { error: 'Pick a start and end time.' };
  const startsAt = nyToUtc(startDate, s);
  const endsAt = nyToUtc(endDate, e);
  if (endsAt <= startsAt) return { error: 'End time must be after start time.' };
  return { startsAt, endsAt, allDay, title, notes, startKey: startDate, endKeyExclusive: addDays(endDate, 1), syncGoogle };
}

function eventOf(b: { startsAt: Date; endsAt: Date; allDay: boolean; title: string; notes: string; startKey: string; endKeyExclusive: string }) {
  return {
    summary: `Blocked${b.title ? ': ' + b.title : ''}`,
    description: [b.notes, 'Blocked from the Parker admin calendar.'].filter(Boolean).join('\n'),
    start: b.startsAt,
    end: b.endsAt,
    allDay: b.allDay ? { startKey: b.startKey, endKey: b.endKeyExclusive } : undefined,
  };
}

export async function createBlock(p: Exclude<ReturnType<typeof parseBlock>, { error: string }>) {
  const gid = p.syncGoogle ? await upsertEvent(eventOf(p)) : null;
  const rows = await sql()`insert into blocks (starts_at, ends_at, all_day, title, notes, google_event_id)
    values (${p.startsAt.toISOString()}, ${p.endsAt.toISOString()}, ${p.allDay}, ${p.title}, ${p.notes}, ${gid}) returning *`;
  return rows[0];
}

export async function updateBlock(id: string, p: Exclude<ReturnType<typeof parseBlock>, { error: string }>) {
  const cur = (await sql()`select * from blocks where id = ${id}`)[0];
  if (!cur) return null;
  let gid: string | null = cur.google_event_id;
  if (gid) gid = (await upsertEvent(eventOf(p), gid)) || gid;
  else if (p.syncGoogle) gid = await upsertEvent(eventOf(p));
  const rows = await sql()`update blocks set starts_at = ${p.startsAt.toISOString()}, ends_at = ${p.endsAt.toISOString()}, all_day = ${p.allDay},
    title = ${p.title}, notes = ${p.notes}, google_event_id = ${gid}, updated_at = now() where id = ${id} returning *`;
  return rows[0];
}

export async function removeBlock(id: string) {
  const rows = await sql()`delete from blocks where id = ${id} returning google_event_id`;
  if (!rows.length) return false;
  await deleteEvent(rows[0].google_event_id);
  return true;
}
