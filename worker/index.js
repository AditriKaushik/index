// Cloudflare Worker: Paytm Money live-quote proxy for the NSE Trade Decision tool.
//
// Why this exists: NSE-derived quote data can't be fetched directly from the browser page
// (Paytm Money's API sets no CORS header for third-party origins, and the security-master
// symbol lookup + token exchange need a secret api_secret_key that must never ship to a client).
// This Worker holds that secret, brokers the daily login, and exposes a small read-only JSON API.
//
// Endpoints:
//   GET  /login            -> redirects to Paytm Money's login page
//   GET  /callback          -> Paytm Money redirects here with ?request_token=...; exchanges it
//                              for an access token and stores it in KV until next midnight IST
//   GET  /status             -> { loggedIn: boolean }
//   GET  /quote?symbol=X&key=SHARED_SECRET -> { price, high, low, volume, ... }
//
// Required bindings (see wrangler.toml / repo setup docs):
//   KV namespace  PM_KV
//   secrets       PM_API_KEY, PM_API_SECRET, APP_SHARED_SECRET
//   vars          ALLOWED_ORIGIN (optional, defaults to "*")

const PM_HOST = 'https://developer.paytmmoney.com';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    try {
      if (url.pathname === '/login') return handleLogin(url, env);
      if (url.pathname === '/callback') return await handleCallback(url, env);
      if (url.pathname === '/status') return await handleStatus(env, cors);
      if (url.pathname === '/quote') return await handleQuote(url, env, cors);
      return json({ error: 'not_found' }, 404, cors);
    } catch (err) {
      return json({ error: 'internal_error', detail: String((err && err.message) || err) }, 500, cors);
    }
  },
};

function corsHeaders(env) {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

function html(body, status = 200) {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// ---- Login flow -----------------------------------------------------------

function handleLogin(url, env) {
  if (!env.PM_API_KEY) return html('<p>Server not configured: missing PM_API_KEY.</p>', 500);
  const state = crypto.randomUUID();
  const loginUrl = `https://login.paytmmoney.com/merchant-login?apiKey=${encodeURIComponent(env.PM_API_KEY)}&state=${encodeURIComponent(state)}`;
  return Response.redirect(loginUrl, 302);
}

async function handleCallback(url, env) {
  const requestToken = url.searchParams.get('request_token') || url.searchParams.get('requestToken');
  if (!requestToken) {
    return html(`<p>Paytm Money did not send a request_token. Raw query: ${escapeHtml(url.search)}</p>`, 400);
  }

  const resp = await fetch(`${PM_HOST}/accounts/v2/gettoken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: env.PM_API_KEY,
      api_secret_key: env.PM_API_SECRET,
      request_token: requestToken,
    }),
  });
  const data = await resp.json().catch(() => null);

  if (!resp.ok || !data || !data.access_token) {
    return html(`<p>Token exchange failed (HTTP ${resp.status}): ${escapeHtml(JSON.stringify(data))}</p>`, 502);
  }

  const ttlSeconds = secondsUntilNextMidnightIST();
  await env.PM_KV.put('access_token', data.access_token, { expirationTtl: ttlSeconds });
  if (data.read_access_token) {
    await env.PM_KV.put('read_access_token', data.read_access_token, { expirationTtl: ttlSeconds });
  }

  return html(`
    <!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>Logged in</title>
    <style>body{font-family:-apple-system,sans-serif;background:#0e131e;color:#e7ecf7;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px}
    div{max-width:340px}h1{font-size:20px}p{color:#96a2ba;font-size:14px}</style></head>
    <body><div><h1>Logged in to Paytm Money</h1><p>This session is valid until midnight IST. You can close this tab and go back to the app.</p></div></body></html>
  `);
}

function secondsUntilNextMidnightIST() {
  const now = new Date();
  const istOffsetMs = 5.5 * 3600 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  const istMidnightUTC = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate() + 1);
  const nextMidnightUTCms = istMidnightUTC - istOffsetMs;
  return Math.max(60, Math.floor((nextMidnightUTCms - now.getTime()) / 1000));
}

async function handleStatus(env, cors) {
  const token = await env.PM_KV.get('access_token');
  return json({ loggedIn: !!token }, 200, cors);
}

// ---- Quote ------------------------------------------------------------

async function handleQuote(url, env, cors) {
  if (env.APP_SHARED_SECRET && url.searchParams.get('key') !== env.APP_SHARED_SECRET) {
    return json({ error: 'unauthorized' }, 401, cors);
  }

  const symbol = (url.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol) return json({ error: 'symbol_required' }, 400, cors);

  const token = (await env.PM_KV.get('read_access_token')) || (await env.PM_KV.get('access_token'));
  if (!token) return json({ error: 'not_logged_in' }, 401, cors);

  let scripId;
  try {
    scripId = await resolveScripId(symbol, env);
  } catch (err) {
    return json({ error: 'security_master_error', detail: String((err && err.message) || err) }, 502, cors);
  }
  if (!scripId) return json({ error: 'symbol_not_found', symbol }, 404, cors);

  const pref = `NSE:${scripId}:EQUITY`;
  const quoteUrl = `${PM_HOST}/data/v1/price/live?mode=QUOTE&pref=${encodeURIComponent(pref)}`;
  const resp = await fetch(quoteUrl, { headers: { 'x-jwt-token': token, 'Content-Type': 'application/json' } });

  if (resp.status === 401) {
    return json({ error: 'not_logged_in', detail: 'Token expired or invalid - log in again.' }, 401, cors);
  }

  const raw = await resp.json().catch(() => null);
  if (!resp.ok || !raw) {
    return json({ error: 'upstream_error', status: resp.status, raw }, 502, cors);
  }

  const tick = Array.isArray(raw.data) ? raw.data[0] : raw.data;
  if (!tick || tick.found === false) {
    return json({ error: 'no_data', symbol, raw }, 502, cors);
  }

  return json({
    symbol,
    scripId,
    price: numOrNull(tick.last_price),
    open: numOrNull(tick.ohlc && tick.ohlc.open),
    high: numOrNull(tick.ohlc && tick.ohlc.high),
    low: numOrNull(tick.ohlc && tick.ohlc.low),
    prevClose: numOrNull(tick.ohlc && tick.ohlc.close),
    volume: numOrNull(tick.volume_traded),
    changePercent: numOrNull(tick.change_percent),
    asOf: tick.last_trade_time || null,
  }, 200, cors);
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---- Security master (symbol -> scrip_id) lookup, cached in KV for a day -----------------

async function resolveScripId(symbol, env) {
  const cacheKey = 'nse_security_map_v1';
  let map = await env.PM_KV.get(cacheKey, { type: 'json' });
  if (!map) {
    map = await buildSecurityMasterMap();
    await env.PM_KV.put(cacheKey, JSON.stringify(map), { expirationTtl: 60 * 60 * 24 });
  }
  return map[symbol] || null;
}

async function buildSecurityMasterMap() {
  const resp = await fetch(`${PM_HOST}/data/v1/scrips/nse_security_master.csv`);
  if (!resp.ok) throw new Error(`security master fetch failed: HTTP ${resp.status}`);
  const text = await resp.text();
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('security master file looked empty');

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const symbolIdx = findCol(header, ['trading_symbol', 'tradingsymbol', 'symbol', 'scrip_name', 'scripname']);
  const idIdx = findCol(header, ['scrip_id', 'scripid', 'security_id', 'securityid', 'token']);
  const segmentIdx = findCol(header, ['segment', 'series', 'instrument_type', 'instrumenttype', 'exchange_segment']);

  if (symbolIdx === -1 || idIdx === -1) {
    throw new Error(`could not find symbol/id columns in security master header: ${header.join(',')}`);
  }

  const map = {};
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const sym = (cols[symbolIdx] || '').trim().toUpperCase();
    const id = (cols[idIdx] || '').trim();
    if (!sym || !id) continue;
    if (segmentIdx !== -1) {
      const seg = (cols[segmentIdx] || '').trim().toUpperCase();
      // Keep only plain-equity rows so a symbol doesn't resolve to an F&O/ETF row instead.
      if (seg && !['EQ', 'E', 'EQUITY', 'CM'].includes(seg)) continue;
    }
    if (!map[sym]) map[sym] = id;
  }
  return map;
}

function splitCsvLine(line) {
  return line.split(',').map((c) => c.replace(/\r$/, ''));
}

function findCol(header, candidates) {
  for (const c of candidates) {
    const idx = header.indexOf(c);
    if (idx !== -1) return idx;
  }
  return -1;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
