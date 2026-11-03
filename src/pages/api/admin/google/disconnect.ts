import type { APIRoute } from 'astro';
import { disconnect } from '../../../../lib/google';
import { json } from '../../../../lib/http';

export const POST: APIRoute = async ({ url }) => {
  await disconnect(url.origin);
  return json({ ok: true });
};
