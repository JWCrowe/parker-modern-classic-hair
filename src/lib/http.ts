export function json(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export const bad = (error: string, status = 400) => json({ error }, status);

export async function readJson<T = any>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function siteUrl(fallback?: URL | string) {
  const v = (typeof process !== 'undefined' && process.env?.PUBLIC_SITE_URL) || import.meta.env.PUBLIC_SITE_URL;
  if (v) return String(v).replace(/\/$/, '');
  if (fallback) return new URL(String(fallback)).origin;
  return 'https://parkermodernclassichair.com';
}

export const escapeHtml = (s: string) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function normPhone(p: string) {
  const d = p.replace(/\D/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return ten;
}

export function fmtPhone(p: string | null | undefined) {
  if (!p) return '';
  const d = normPhone(p);
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : p;
}
