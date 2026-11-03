import { Resend } from 'resend';
import { env } from './env';
import { escapeHtml } from './http';
import { business } from '../data/site';

type Mail = { to: string | string[]; subject: string; heading: string; lines: [string, string][]; intro?: string; cta?: { label: string; href: string }; replyTo?: string };

function html(m: Mail) {
  const rows = m.lines
    .map(([k, v]) => `<tr><td style="padding:10px 0;border-bottom:1px solid #2a2622;color:#8f8676;font:600 11px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #2a2622;color:#efe6d2;font:15px Arial,sans-serif;text-align:right">${escapeHtml(v)}</td></tr>`)
    .join('');
  const cta = m.cta
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(m.cta.href)}" style="display:inline-block;background:#c9a25a;color:#0a0908;padding:14px 22px;font:700 12px Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;text-decoration:none">${escapeHtml(m.cta.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#0a0908;padding:32px 16px">
  <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#121110;border:1px solid rgba(201,162,90,.35)"><tr><td style="padding:32px">
    <p style="margin:0 0 6px;color:#c9a25a;font:600 11px Arial,sans-serif;letter-spacing:4px;text-transform:uppercase">${escapeHtml(business.name)}</p>
    <h1 style="margin:0 0 14px;color:#efe6d2;font:400 32px Impact,'Arial Narrow',sans-serif;text-transform:uppercase;letter-spacing:.5px">${escapeHtml(m.heading)}</h1>
    ${m.intro ? `<p style="margin:0 0 18px;color:#d8ceb8;font:15px/1.6 Arial,sans-serif">${escapeHtml(m.intro)}</p>` : ''}
    <table role="presentation" width="100%" style="border-collapse:collapse">${rows}</table>
    ${cta}
    <p style="margin:28px 0 0;color:#8f8676;font:13px/1.6 Arial,sans-serif">${escapeHtml(business.street)}, ${escapeHtml(business.city)}, ${escapeHtml(business.region)} ${escapeHtml(business.zip)}<br>${escapeHtml(business.phone)}</p>
  </td></tr></table></body></html>`;
}

function text(m: Mail) {
  return [m.heading, m.intro || '', ...m.lines.map(([k, v]) => `${k}: ${v}`), m.cta ? `${m.cta.label}: ${m.cta.href}` : '', '', `${business.name}, ${business.phone}`]
    .filter((l) => l !== undefined)
    .join('\n');
}

/** Sends through Resend. Without RESEND_API_KEY it logs the email and reports success (dev mode). Never throws. */
export async function sendMail(m: Mail): Promise<{ ok: boolean; dev?: boolean; error?: string }> {
  const key = env('RESEND_API_KEY');
  const from = env('RESEND_FROM') || 'Parker Modern Classic Hair <onboarding@resend.dev>';
  if (!key) {
    console.log(`[email:dev] to=${[m.to].flat().join(',')} subject="${m.subject}"\n${text(m)}`);
    return { ok: true, dev: true };
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({ from, to: m.to, subject: m.subject, html: html(m), text: text(m), replyTo: m.replyTo });
    if (error) {
      console.error('[email] resend error', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error('[email] send failed', (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}

export function adminNotifyEmail() {
  return env('ADMIN_NOTIFY_EMAIL') || env('ADMIN_EMAIL') || business.email;
}
