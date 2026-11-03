// Small helpers shared by admin pages.
export async function api(url: string, method = 'GET', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'content-type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.includes('/auth/')) location.href = '/admin/login?next=' + encodeURIComponent(location.pathname + location.search);
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

let t: number | undefined;
export function toast(msg: string, bad = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.toggle('bad', bad);
  el.classList.add('on');
  clearTimeout(t);
  t = window.setTimeout(() => el!.classList.remove('on'), bad ? 6000 : 2600);
}

/** Buttons like <button data-api="/api/..." data-method="PATCH" data-body='{"status":"confirmed"}' data-confirm="Sure?" data-done="Saved"> */
export function wireActions(root: ParentNode = document) {
  root.querySelectorAll<HTMLButtonElement>('[data-api]').forEach((b) => {
    if (b.dataset.wired) return;
    b.dataset.wired = '1';
    b.addEventListener('click', async (e) => {
      e.preventDefault();
      if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
      b.disabled = true;
      try {
        const r = await api(b.dataset.api!, b.dataset.method || 'POST', b.dataset.body ? JSON.parse(b.dataset.body) : {});
        toast(b.dataset.done || (r.emailed ? 'Done. Client emailed.' : 'Done.'));
        setTimeout(() => (b.dataset.go ? (location.href = b.dataset.go) : location.reload()), 500);
      } catch (err) {
        toast((err as Error).message, true);
        b.disabled = false;
      }
    });
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => wireActions());
else wireActions();
