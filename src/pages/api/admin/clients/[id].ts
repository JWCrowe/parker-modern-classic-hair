import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { bad, fmtPhone, json, normPhone, readJson, str } from '../../../../lib/http';
import { getClient } from '../../../../lib/crm';

export const GET: APIRoute = async ({ params }) => {
  const c = await getClient(params.id!);
  return c ? json(c) : bad('Not found', 404);
};

// PATCH { name?, email?, phone?, notes? }
export const PATCH: APIRoute = async ({ params, request }) => {
  const b = await readJson(request);
  if (!b) return bad('Send JSON.');
  const cur = (await sql()`select * from clients where id = ${params.id!}`)[0];
  if (!cur) return bad('Not found', 404);
  const name = b.name !== undefined ? str(b.name, 120) : cur.name;
  if (!name) return bad('Name is required.');
  const email = b.email !== undefined ? str(b.email, 200).toLowerCase() || null : cur.email;
  let phone = cur.phone;
  if (b.phone !== undefined) {
    const p = str(b.phone, 40);
    if (p && normPhone(p).length !== 10) return bad('Phone should be 10 digits.');
    phone = p ? fmtPhone(p) : null;
  }
  const notes = b.notes !== undefined ? str(b.notes, 4000) : cur.notes;
  await sql()`update clients set name = ${name}, email = ${email}, phone = ${phone}, notes = ${notes}, updated_at = now() where id = ${cur.id}`;
  return json({ ok: true });
};
