// Guardian: signalling + location relay for the live-safety-sharing app.
//
// Design note, because it drives everything below: this Worker is deliberately
// dumb. It never sees a location, a name, or a stream. The browser encrypts
// every payload with an AES-GCM key that lives only in the fragment of the
// share link (`https://.../guardian/#v1.<room>.<key>`), and a fragment is never
// sent to a server. What arrives here is a room id, a peer id, and ciphertext.
// Audio and video never come here at all - they go peer-to-peer over WebRTC,
// and this only brokers the encrypted offer/answer handshake.
//
// Endpoints (mounted under /guardian by worker/index.js):
//   GET /guardian/ws?room=<id>&role=share|watch  -> WebSocket into the room
//   GET /guardian/ice                            -> STUN/TURN config for WebRTC
//   GET /guardian/health                         -> { ok: true }

const ROOM_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ROLES = new Set(['share', 'watch']);

// Guard rails for a room. These are about keeping one link from being turned
// into a broadcast channel or a flooding target, not about product limits.
const MAX_PEERS = 12;
const MAX_MESSAGE_BYTES = 96 * 1024; // an encrypted SDP offer is a few KB
const RATE_WINDOW_MS = 10_000;
const RATE_MAX_MESSAGES = 120;
const ROOM_MAX_LIFETIME_MS = 12 * 60 * 60 * 1000;

export async function handleGuardian(request, url, env, cors) {
  const path = url.pathname.replace(/^\/guardian/, '') || '/';

  if (path === '/health') {
    const turn = Boolean(env.TURN_URL || (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN));
    return jsonResponse({ ok: true, turn }, 200, cors);
  }

  if (path === '/ice') {
    return jsonResponse({ iceServers: await iceServers(env) }, 200, cors);
  }

  if (path === '/ws') {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return jsonResponse({ error: 'expected_websocket' }, 426, cors);
    }
    if (!originAllowed(request, env)) {
      return jsonResponse({ error: 'origin_not_allowed' }, 403, cors);
    }

    const room = url.searchParams.get('room') || '';
    const role = url.searchParams.get('role') || '';
    if (!ROOM_ID_RE.test(room)) return jsonResponse({ error: 'bad_room' }, 400, cors);
    if (!ROLES.has(role)) return jsonResponse({ error: 'bad_role' }, 400, cors);

    if (!env.SAFETY_ROOMS) {
      return jsonResponse({ error: 'not_configured', detail: 'SAFETY_ROOMS binding missing' }, 503, cors);
    }

    const id = env.SAFETY_ROOMS.idFromName(room);
    return env.SAFETY_ROOMS.get(id).fetch(request);
  }

  return jsonResponse({ error: 'not_found' }, 404, cors);
}

// A TURN relay is what makes voice and video connect on mobile networks with
// symmetric NAT. It is optional - location sharing never needs it - so /ice
// always returns at least STUN and the app degrades rather than fails.
async function iceServers(env) {
  const servers = [
    { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] },
  ];

  // Preferred: Cloudflare Realtime TURN. Mints short-lived credentials on demand
  // (nothing long-lived to leak) and needs no separate provider account - just
  // two Worker secrets, CF_TURN_KEY_ID and CF_TURN_API_TOKEN. If the call fails
  // for any reason we fall through to static creds / STUN so /ice never breaks.
  if (env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN) {
    try {
      const cf = await mintCloudflareTurn(env);
      if (cf) { servers.push(cf); return servers; }
    } catch (_) { /* fall through */ }
  }

  // Static credentials from any other provider (Metered, coturn, Twilio, ...).
  if (env.TURN_URL && env.TURN_USERNAME && env.TURN_CREDENTIAL) {
    servers.push({
      urls: env.TURN_URL.split(',').map((u) => u.trim()).filter(Boolean),
      username: env.TURN_USERNAME,
      credential: env.TURN_CREDENTIAL,
    });
  }
  return servers;
}

async function mintCloudflareTurn(env) {
  const resp = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.CF_TURN_KEY_ID)}/credentials/generate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.CF_TURN_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 }),
    }
  );
  if (!resp.ok) throw new Error(`cloudflare turn HTTP ${resp.status}`);
  const data = await resp.json().catch(() => null);
  const ice = data && data.iceServers;
  if (!ice || !ice.urls) return null;
  return {
    urls: Array.isArray(ice.urls) ? ice.urls : [ice.urls],
    username: ice.username,
    credential: ice.credential,
  };
}

function originAllowed(request, env) {
  const allowed = env.ALLOWED_ORIGIN || '*';
  if (allowed === '*') return true;
  const origin = request.headers.get('Origin');
  if (!origin) return true; // non-browser clients, e.g. a health check
  return allowed.split(',').map((o) => o.trim()).includes(origin);
}

function jsonResponse(data, status, cors) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(cors || {}), 'Content-Type': 'application/json' },
  });
}

// ---- The room ------------------------------------------------------------

export class SafetyRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.peers = new Map();       // peerId -> { socket, role, seen: number[] }
    this.retained = new Map();    // "<peerId>:<tag>" -> envelope
    this.createdAt = Date.now();
  }

  async fetch(request) {
    const url = new URL(request.url);
    const role = url.searchParams.get('role');

    if (Date.now() - this.createdAt > ROOM_MAX_LIFETIME_MS) {
      return new Response('room expired', { status: 410 });
    }
    if (this.peers.size >= MAX_PEERS) {
      return new Response('room full', { status: 429 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const peerId = crypto.randomUUID().slice(0, 8);

    server.accept();
    const peer = { socket: server, role, seen: [] };
    this.peers.set(peerId, peer);

    send(server, {
      t: 'welcome',
      peerId,
      now: Date.now(),
      peers: [...this.peers.entries()]
        .filter(([id]) => id !== peerId)
        .map(([id, p]) => ({ peerId: id, role: p.role })),
    });

    // Hand the newcomer whatever the others last said - still ciphertext, so
    // a watcher who opens the link ten minutes in sees the current position
    // straight away instead of waiting for the next update.
    for (const envelope of this.retained.values()) {
      if (envelope.from !== peerId) send(server, envelope);
    }

    this.broadcast({ t: 'peer-join', peerId, role }, peerId);

    server.addEventListener('message', (event) => this.onMessage(peerId, peer, event));
    const close = () => this.onClose(peerId);
    server.addEventListener('close', close);
    server.addEventListener('error', close);

    return new Response(null, { status: 101, webSocket: client });
  }

  onMessage(peerId, peer, event) {
    const data = event.data;
    if (typeof data !== 'string') return;
    if (data.length > MAX_MESSAGE_BYTES) {
      send(peer.socket, { t: 'error', code: 'too_large' });
      return;
    }
    if (!this.allow(peer)) {
      send(peer.socket, { t: 'error', code: 'rate_limited' });
      return;
    }

    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'ping') {
      send(peer.socket, { t: 'pong', now: Date.now() });
      return;
    }
    if (msg.t !== 'relay' || typeof msg.ct !== 'string' || typeof msg.iv !== 'string') return;

    // `from` is stamped here rather than trusted from the sender, so a peer
    // cannot pose as someone else in the room.
    const envelope = { t: 'relay', from: peerId, iv: msg.iv, ct: msg.ct };
    if (typeof msg.retain === 'string' && msg.retain.length <= 16) {
      envelope.retain = msg.retain;
      this.retained.set(`${peerId}:${msg.retain}`, envelope);
    }

    if (typeof msg.to === 'string') {
      const target = this.peers.get(msg.to);
      if (target) send(target.socket, envelope);
      return;
    }
    this.broadcast(envelope, peerId);
  }

  onClose(peerId) {
    if (!this.peers.has(peerId)) return;
    this.peers.delete(peerId);
    for (const key of [...this.retained.keys()]) {
      if (key.startsWith(`${peerId}:`)) this.retained.delete(key);
    }
    this.broadcast({ t: 'peer-leave', peerId }, peerId);
  }

  allow(peer) {
    const now = Date.now();
    peer.seen = peer.seen.filter((t) => now - t < RATE_WINDOW_MS);
    if (peer.seen.length >= RATE_MAX_MESSAGES) return false;
    peer.seen.push(now);
    return true;
  }

  broadcast(msg, exceptPeerId) {
    for (const [id, peer] of this.peers) {
      if (id === exceptPeerId) continue;
      send(peer.socket, msg);
    }
  }
}

function send(socket, msg) {
  try {
    socket.send(JSON.stringify(msg));
  } catch {
    // A peer that has gone away is cleaned up by its own close event.
  }
}
