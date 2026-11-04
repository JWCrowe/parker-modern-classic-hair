import type { APIRoute } from 'astro';
// Google Calendar connect is turned off. Square is the only calendar and booking source of truth.
// The OAuth helpers in src/lib/google.ts stay in the codebase unused.
export const GET: APIRoute = async ({ redirect }) => redirect('/admin/settings', 303);
