import type { APIRoute } from 'astro';
import { squareAuthUrl, squareOAuthConfigured } from '../../../../lib/square';
import { newState } from '../../../../lib/oauth-state';

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  if (!squareOAuthConfigured()) return redirect('/admin/settings?square=missing-config', 303);
  const state = newState(cookies, 'pm_sq_state', url.protocol === 'https:');
  return redirect(squareAuthUrl(url.origin, state), 302);
};
