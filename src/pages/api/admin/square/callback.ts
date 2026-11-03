import type { APIRoute } from 'astro';
import { exchangeSquareCode } from '../../../../lib/square';
import { syncSquareBookings } from '../../../../lib/square-sync';
import { checkState } from '../../../../lib/oauth-state';

export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const err = url.searchParams.get('error');
  if (err) return redirect(`/admin/settings?square=${encodeURIComponent(err)}&msg=${encodeURIComponent(url.searchParams.get('error_description') || '')}`, 303);
  if (!checkState(cookies, 'pm_sq_state', url.searchParams.get('state'))) return redirect('/admin/settings?square=bad-state', 303);
  const code = url.searchParams.get('code');
  if (!code) return redirect('/admin/settings?square=no-code', 303);
  try {
    await exchangeSquareCode(url.origin, code);
    await syncSquareBookings({ pastDays: 365, futureDays: 62 });
    return redirect('/admin/settings?square=connected', 303);
  } catch (e) {
    console.error('[square callback]', (e as Error).message);
    return redirect(`/admin/settings?square=error&msg=${encodeURIComponent((e as Error).message.slice(0, 200))}`, 303);
  }
};
