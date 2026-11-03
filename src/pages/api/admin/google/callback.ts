import type { APIRoute } from 'astro';
import { exchangeCode } from '../../../../lib/google';
import { checkState } from '../../../../lib/oauth-state';

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const err = url.searchParams.get('error');
  if (err) return redirect(`/admin/settings?google=${encodeURIComponent(err)}`, 303);
  if (!checkState(cookies, 'pm_g_state', url.searchParams.get('state'))) return redirect('/admin/settings?google=bad-state', 303);
  const code = url.searchParams.get('code');
  if (!code) return redirect('/admin/settings?google=no-code', 303);
  try {
    await exchangeCode(url.origin, code);
    return redirect('/admin/settings?google=connected', 303);
  } catch (e) {
    console.error('[google callback]', (e as Error).message);
    return redirect(`/admin/settings?google=error&msg=${encodeURIComponent((e as Error).message.slice(0, 200))}`, 303);
  }
};
