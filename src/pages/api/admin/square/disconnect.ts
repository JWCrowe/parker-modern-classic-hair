import type { APIRoute } from 'astro';
import { disconnectSquare } from '../../../../lib/square';
import { json } from '../../../../lib/http';

export const POST: APIRoute = async () => {
  await disconnectSquare();
  return json({ ok: true });
};
