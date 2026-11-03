import type { APIRoute } from 'astro';
import { json } from '../../../lib/http';

export const GET: APIRoute = async ({ locals }) => {
  if (!locals.admin) return json({ admin: null }, 401);
  return json({ admin: { email: locals.admin.email, name: locals.admin.name } });
};
