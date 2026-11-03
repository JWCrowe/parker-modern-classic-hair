import type { APIRoute } from 'astro';
import { authUrl, googleConfigured } from '../../../../lib/google';
import { newState } from '../../../../lib/oauth-state';

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!googleConfigured()) return redirect('/admin/settings?google=missing-config', 303);
  const state = newState(cookies, 'pm_g_state', url.protocol === 'https:');
  return redirect(authUrl(url.origin, state), 302);
};
