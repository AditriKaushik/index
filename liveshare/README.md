# Live Share

Share your **live location** and **live voice** with people you trust —
end-to-end encrypted. Open **one link** on both phones and you're connected. No
codes to copy, no accounts, and nothing is ever stored on a server.

## How to use it

1. One person taps **Create a link** and sends it (WhatsApp/SMS) or shows its
   **QR** for the other to scan. Anyone who opens the link is in the group.
2. On each phone: tap **Share** (send my live location & voice) or **Watch**
   (see & hear someone who's sharing).
3. That's it — they connect automatically. The watcher sees the sharer's live
   location on a map link and hears their microphone. Either side taps **Stop**
   (or **Leave group**) to end it.

Voice is a bonus: if a phone won't give its microphone, it still shares **live
location** and voice simply stays off.

## Why it's private

- **End-to-end encrypted.** Each link contains a random AES-256-GCM key in its
  `#` fragment, which browsers never send to any server. The WebRTC handshake
  and every location update are encrypted with it; voice/video go
  peer-to-peer (WebRTC's own DTLS-SRTP). Anyone who intercepts the relay traffic
  sees only scrambled bytes.
- **Nothing stored.** The relay is a dumb rendezvous: it knows a room id and
  forwards encrypted bytes between the two phones, then forgets. No accounts, no
  database, no history. Location, voice and video never touch it.
- **Consent-based, visible.** You choose to Share; the other chooses to Watch.
  While sharing, the phone shows it (a banner, a live mic meter, and on Android
  an ongoing notification). There is no hidden/covert mode.

## The relay (one-time setup)

Easy, code-free pairing needs a tiny **relay server** to introduce the two
phones. This repo ships one — the Cloudflare Worker in [`../worker`](../worker)
(`/guardian/ws`, `/guardian/ice`). It only passes encrypted bytes and stores
nothing.

1. **Deploy the Worker.** Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
   as GitHub repository secrets; the [`deploy-worker`](../.github/workflows/deploy-worker.yml)
   workflow then deploys it on every push. (Or run `npx wrangler deploy` from
   the repo root.) The Durable Object binding is already in `wrangler.toml` and
   works on the Workers free plan.
2. **Point the app at it**, once, in either of two ways:
   - Set `BUILTIN_RELAY` near the top of `index.html` to the Worker address
     (e.g. `https://<name>.<subdomain>.workers.dev`) — then nobody ever
     configures anything, and
   - or, leave it blank and enter the address once under **Advanced → relay
     server** in the app. Either way the address is baked into every link you
     create, so people you invite set nothing.
3. **Optional: TURN** for voice/video on strict mobile networks (location never
   needs it). Set Cloudflare Realtime TURN (`CF_TURN_KEY_ID`,
   `CF_TURN_API_TOKEN`) or a static provider (`TURN_URL`, `TURN_USERNAME`,
   `TURN_CREDENTIAL`) as Worker secrets; `/guardian/ice` serves them.

## Honest limits

- The relay must be reachable for phones to find each other. Media itself is
  still direct P2P; on a few strict networks a TURN server (above) is needed for
  voice/video to connect (location works regardless).
- In a browser tab, sharing stops when the tab is closed. The
  [Android app](../android) keeps it running with the screen off.
- Must be opened over **https** — location, mic and the crypto APIs are off on
  insecure pages.

## Browser support

Chrome, Edge, Samsung Internet on Android, and Safari on iOS 16.4+. On Android
the [APK](../android) is the better way to run it.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app — UI, crypto, geolocation, mic, WebRTC, relay signaling, QR |
| `vendor/qrcode.min.js` | QR encoder (qrcode-generator, MIT) — draws the link QR |
| `vendor/jsQR.min.js` | QR decoder (jsQR, Apache-2.0) — scan a link to join |
| `../worker/guardian.js` | The relay: the `SafetyRoom` Durable Object + routes |
