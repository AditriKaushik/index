# Guardian — live safety sharing

Share your live location, voice and camera with the people you trust — your
spouse, your parents, a friend — with one tap, and stop it with one tap.

It is a web app, so there is nothing to install: send someone the link and it
opens on whatever phone they already have.

## What it does

- **Live location** on a map, with accuracy, speed and the sharer's battery
  level, updating as they move.
- **Live voice** and **live camera**, phone-to-phone.
- **SOS** — one tap turns on location and voice for four hours and opens the
  phone's share sheet so the link goes out fast.
- **Safe-arrival timer** — "I should be there in 20 minutes". If you don't tap
  *I'm safe*, Guardian starts sharing on its own and sounds an alarm.
- **Messages** both ways, in case talking isn't possible.
- Auto-stop on a timer, and a one-tap *replace link* that kills a link you sent
  to the wrong person.

## How the privacy works

Every sharing session generates a random AES-256-GCM key in the browser. That
key is written into the fragment of the share link — the part after the `#` —
which browsers **never** send to a server. So:

- Location, messages and the WebRTC handshake are encrypted on the phone
  before they leave it. The relay server sees a room id and ciphertext.
- Voice and video never touch the server at all; they go peer-to-peer over
  WebRTC, which is itself encrypted (DTLS-SRTP).
- There is no account, no database and no history. Stopping ends the session
  and the link stops working.

A consequence worth understanding: **anyone holding the link can watch.**
Treat it like a key. If it goes astray, open *Link and privacy options* and
replace it.

Guardian has no hidden or background mode, deliberately. The person sharing has
to tap start, and their phone shows that it is sharing the whole time. It is
built for people who want to be found, not for watching someone who hasn't
agreed.

## The honest limitation

This is a web app, not a native one. If the phone is locked or Guardian is left
in the background for a long time, the browser may throttle or pause location
updates. Guardian holds a screen wake lock while sharing, which helps, and
adding it to the home screen helps more — but for a long journey, keep it on
screen. A native app is the only real fix for this, and this app is not one.

## Setup

The app is static and can be served from GitHub Pages as-is. It needs one small
relay server — the Cloudflare Worker already in this repository — to introduce
two phones to each other.

1. **Deploy the Worker.** From the repository root:

   ```
   npx wrangler kv namespace create PM_KV     # if you have not already
   # put the printed id into wrangler.toml
   npx wrangler deploy
   ```

   The Worker exposes `/guardian/ws`, `/guardian/ice` and `/guardian/health`
   alongside the existing trade-tool routes. The `SAFETY_ROOMS` Durable Object
   binding and its migration are already in `wrangler.toml`; SQLite-backed
   Durable Objects work on the Workers free plan.

2. **Point the app at it.** Open the app, tap ⚙ and paste the Worker address
   (`https://<name>.<subdomain>.workers.dev`), or — better — set `BUILTIN_RELAY`
   near the top of the script in `guardian/index.html` so it needs no setup at
   all. The address is carried inside every share link, so people receiving a
   link never have to configure anything.

3. **Optional: a TURN server.** Location always works. Voice and video use
   STUN only by default, which fails on roughly one mobile network in ten
   (symmetric NAT). To fix that, set three Worker secrets:

   ```
   npx wrangler secret put TURN_URL
   npx wrangler secret put TURN_USERNAME
   npx wrangler secret put TURN_CREDENTIAL
   ```

   Cloudflare Calls, Twilio and a self-hosted coturn all work. `/guardian/health`
   reports whether one is configured, and Settings → *Test connection* shows it.

4. **Optional: lock down the origin.** Set `ALLOWED_ORIGIN` in `wrangler.toml`
   to your Pages origin so the relay only accepts sockets from your own site.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app — UI, crypto, geolocation, WebRTC |
| `sw.js` | Service worker, scoped to `/guardian/`, caches the shell for offline start |
| `manifest.webmanifest` | Home-screen install metadata and the SOS shortcut |
| `icons/` | App icons |
| `../worker/guardian.js` | The relay: routes plus the `SafetyRoom` Durable Object |

## Browser support

Chrome, Edge and Samsung Internet on Android, and Safari on iOS 16.4+, all
support what this needs (WebCrypto, WebRTC, geolocation, service workers).
Screen Wake Lock and the Battery API are absent on iOS; the app works without
them and simply shows less.
