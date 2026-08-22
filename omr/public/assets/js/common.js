/* =====================================================================
   Shared helpers for every page: API calls, escaping, notices.
   ===================================================================== */

/** Call the API. Throws only on network failure; HTTP errors come back as data. */
export async function api(path, { method = 'GET', body = null } = {}) {
  const headers = { 'x-omr-request': '1' };
  if (body !== null) headers['content-type'] = 'application/json';

  const res = await fetch('/api' + path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === null ? undefined : JSON.stringify(body),
  });

  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return { ok: res.ok, _text: await res.text(), _status: res.status };

  const data = await res.json();
  data._status = res.status;
  return data;
}

/** HTML-escape a value for interpolation into markup. */
export function e(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Render a notice into a container element. */
export function notice(el, kind, text) {
  if (!el) return;
  el.innerHTML = text ? `<div class="note ${kind}">${e(text)}</div>` : '';
}

/** Send the visitor to the login page, keeping nothing behind. */
export function toLogin() {
  window.location.href = '/';
}

/** Format a date for display, tolerating nulls. */
export function when(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

/** Status pill markup. */
export function pill(status) {
  const label = {
    draft: 'Draft', open: 'Open for filling',
    closed: 'Closed', published: 'Result published',
  }[status] || status;
  return `<span class="pill ${e(status)}">${e(label)}</span>`;
}
