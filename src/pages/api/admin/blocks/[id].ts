import type { APIRoute } from 'astro';
import { bad, json, readJson } from '../../../../lib/http';
import { parseBlock, removeBlock, updateBlock } from '../../../../lib/blocks';

export const PATCH: APIRoute = async ({ params, request }) => {
  const p = parseBlock(await readJson(request));
  if ('error' in p) return bad(p.error);
  const b = await updateBlock(params.id!, p);
  return b ? json({ ok: true, block: b }) : bad('Not found', 404);
};

export const DELETE: APIRoute = async ({ params }) => ((await removeBlock(params.id!)) ? json({ ok: true }) : bad('Not found', 404));
