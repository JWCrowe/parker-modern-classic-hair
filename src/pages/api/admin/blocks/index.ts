import type { APIRoute } from 'astro';
import { sql } from '../../../../lib/db';
import { bad, json, readJson } from '../../../../lib/http';
import { createBlock, parseBlock } from '../../../../lib/blocks';

export const GET: APIRoute = async ({ url }) => {
  const from = url.searchParams.get('from') || new Date(Date.now() - 86400000).toISOString();
  const to = url.searchParams.get('to') || new Date(Date.now() + 90 * 86400000).toISOString();
  const rows = await sql()`select * from blocks where ends_at > ${from} and starts_at < ${to} order by starts_at`;
  return json({ blocks: rows });
};

// POST { allDay, startDate, endDate?, startTime?, endTime?, title?, notes?, syncGoogle? }
export const POST: APIRoute = async ({ request }) => {
  const p = parseBlock(await readJson(request));
  if ('error' in p) return bad(p.error);
  return json({ ok: true, block: await createBlock(p) }, 201);
};
