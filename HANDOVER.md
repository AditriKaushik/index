# Handover — Live Share

Last updated: 2026-09-22

This document is a handover for the **Live Share** web app and the surrounding
`index` repository. It explains what exists, how it works, how to run and test
it, how it deploys, and what is left to do.

---

## 1. What this project is

**Live Share** (`liveshare/`) is a single-page web app that lets people share
their **live location** and **live microphone** with someone they trust,
**end-to-end encrypted**, with **no account and nothing stored**. Media travels
peer-to-peer over WebRTC. Pairing is now **link-based**: open the same link on
both phones → tap Share / Watch → auto-connected, no codes.

This uses a small **signaling relay** (the Cloudflare Worker in `worker/`,
recovered from the earlier *Guardian* app) purely to introduce the two phones —
it forwards only encrypted bytes and stores nothing. History: the app started
as Guardian (relay + group + camera + Android), was cut down to a serverless
copy/paste-code app, and then — because code/QR pairing was too hard for
non-technical users — moved back to relay-based one-link pairing while staying
minimal (1 sharer → N watchers, location + optional voice).

Design intent: simple enough for a non-technical person, and deliberately
**consent-based and visible** (a sharing phone always shows it is sharing;
there is no hidden/covert mode).

---

## 2. Current status

- ✅ App is built, reviewed, and headless-tested (see §6). Live URL after merge:
  **https://aditrikaushik.github.io/index/liveshare/**
- ✅ Guardian fully removed; the unrelated NSE trade tool is untouched and still
  works.
- ⏳ **Pending:** the latest work is on branch `claude/gracious-brown-9bhpps`.
  It must be **merged into `main`** for GitHub Pages to publish it. (Earlier
  work already merged as PR #13; the compression + QR commits sit on the branch
  waiting to merge.)

Branch history worth knowing:
- Guardian→Live Share replacement — merged into `main` as **PR #13**.
- "shrink the pairing code by compressing it" — on the branch.
- "pair by scanning a QR" — on the branch (latest).

> Note on the workflow: a merged PR is not reused. For each new round of work
> the branch `claude/gracious-brown-9bhpps` is reset to the latest `main`
> (`git checkout -B claude/gracious-brown-9bhpps origin/main`) and the new
> commits are pushed there, then merged as a fresh PR.

---

## 3. Repository layout

```
index/
├─ liveshare/                 # THE APP (this project)
│  ├─ index.html              # entire app: UI, crypto, geolocation, mic, WebRTC, QR
│  ├─ README.md               # user-facing how-to + privacy notes
│  └─ vendor/                 # the only third-party code, served locally (no CDN)
│     ├─ qrcode.min.js        # QR encoder (qrcode-generator, MIT)
│     └─ jsQR.min.js          # QR decoder (jsQR, Apache-2.0)
├─ index.html                 # UNRELATED: NSE ₹1-lakh intraday framework write-up
├─ trade-decision.html        # UNRELATED: NSE trade-decision tool
├─ manifest.json, sw.js       # UNRELATED: PWA bits for the trade tool
├─ icons/                     # UNRELATED: trade-tool icons
├─ worker/index.js            # Cloudflare Worker: trade-tool quote proxy + Live Share relay routes
├─ worker/guardian.js         # the Live Share signaling relay (SafetyRoom Durable Object)
├─ wrangler.toml              # Worker config (trade tool only; Guardian bindings removed)
├─ android/                   # Live Share as an Android app (background sharing)
│  ├─ app/src/main/java/org/mahendras/guardian/   # package name kept from earlier
│  │  ├─ MainActivity.java     # WebView + permissions + JS bridge (LiveShareHost)
│  │  ├─ SharingService.java   # foreground service that keeps sharing alive
│  │  └─ GuardianApp.java      # notification channel
│  ├─ app/src/main/AndroidManifest.xml
│  └─ app/build.gradle         # bundles ../liveshare into assets at build time
├─ .github/workflows/
│  ├─ deploy-pages.yml         # publishes the static site to GitHub Pages
│  ├─ build-apk.yml            # builds + publishes the Android APK (apk-latest release)
│  └─ deploy-worker.yml        # deploys the Worker
└─ HANDOVER.md                # this file
```

The Worker (`worker/index.js` + `worker/guardian.js`) now serves **both** the
NSE trade tool's quote proxy **and** Live Share's signaling relay (mounted at
`/guardian/*`). `wrangler.toml` carries the `SAFETY_ROOMS` Durable Object
binding + migration. Live Share cannot pair without this relay deployed.

---

## 4. How Live Share works

### Link + roles
`index.html` reads the link fragment `#<room>.<keyB64>[.<relayB64>]`:
`room` is a random id, `keyB64` is the 32-byte AES-256-GCM key (never sent to a
server), and the optional third part carries the relay address so invitees
configure nothing. **Create a link** generates room+key and bakes in the relay
(from `BUILTIN_RELAY` or the Advanced box / localStorage). Both phones open the
link → tap **Share** or **Watch**.

### Pairing (relay-signalled, automatic)
The relay (`worker/guardian.js`, a `SafetyRoom` Durable Object) is a WebSocket
rendezvous: `welcome` / `peer-join` / `peer-leave` presence, and `relay`
messages `{iv,ct}` that it forwards (optionally targeted with `to`, stamped with
`from`) without decrypting. The client:
1. Connects `wss://<relay>/guardian/ws?room=…&role=share|watch`.
2. **Sharer** offers to every `watch` peer (one `RTCPeerConnection` each →
   supports 1 sharer → N watchers), sending encrypted `{k:'offer'|'ice'}`.
3. **Watcher** answers (`{k:'answer'|'ice'}`). Only the sharer offers, so no
   glare. Trickle ICE, candidates queued until the remote description is set.
4. Then location (encrypted, over the data channel) + optional voice (WebRTC
   media, DTLS-SRTP) flow peer-to-peer. STUN/TURN come from `/guardian/ice`.

### Encryption
- Key = 32 random bytes carried in the link fragment → `importKey` AES-256-GCM.
- `seal(obj)`→`{iv,ct}` / `open_(iv,ct)`; every signaling payload and every
  location update is sealed. The relay only ever sees ciphertext.
- Voice/video ride WebRTC's own DTLS-SRTP.

### Key functions in `index.html`
- `parseHash` / `buildLink` / `currentLink`, `importKey`, `seal` / `open_`
- `connect` / `onWs` / `relaySend` / `handleSignal` — relay signaling
- `startShare` / `offerTo` / `startGeo` / `getMic` / `startMicMeter`
- `startWatch` / `onLocationMsg`
- `keepAwake` / `releaseWake`, `nativeSharing` (Android bridge)
- `startScan` / `stopScan` (jsQR — scan a link), `shareLink`, `leave` (teardown)

### Consent / safety design
Sharing is always visible: a red "You are sharing…" banner, a live mic-level
meter, and one-tap Stop. There is no background/hidden mode. It is intended for
two people who both set it up together.

---

## 5. Deployment

- **GitHub Pages** serves the static site. `.github/workflows/deploy-pages.yml`
  runs on push to `main`, copies an allowlist of files into `_site/` (including
  `cp -r liveshare _site/`, which pulls in `vendor/` too), refuses to publish
  any server-side files, and deploys.
- So: **merging the branch into `main` is what makes Live Share live.** Give it
  ~1 minute after merge.
- The Worker (`deploy-worker.yml` + `wrangler.toml`) is unrelated to Live Share
  and does not need to be touched for it.

---

## 6. Running and testing locally

The app must run over a **secure context** (https, or `localhost`) or the
crypto/mic/location/camera APIs are disabled — the page guards for this and
shows an "open over https" message otherwise.

Quick static serve + open:
```bash
cd liveshare
python3 -m http.server 8000   # then open http://localhost:8000/ (localhost = secure context)
```
A single machine can't fully exercise the two-phone handshake (needs two real
devices with mic/GPS/camera), so use two phones on the live URL for real E2E.

Checks used during development (all passed):
- `node --check` on the extracted inline `<script>` — syntax.
- Headless Chromium (Playwright, already installed at
  `/opt/node22/lib/node_modules/playwright`, browsers at `/opt/pw-browsers`):
  page loads with **no console errors**; screen switching works; bad codes are
  handled gracefully; the QR libraries load; and a generated QR for a realistic
  ~1250-char code **decodes back to the exact code** (version-25 QR).
- Verified the compression round-trip (`deflate→encrypt→decrypt→inflate`) is
  lossless on a real WebRTC offer.

### How the vendored QR libs were produced
CDNs (cdnjs/jsdelivr) are blocked by the egress proxy, but `registry.npmjs.org`
is reachable. They were installed from npm and minified with terser:
```bash
npm install jsqr@1.4.0 qrcode-generator@1.4.4
npx terser@5 node_modules/jsqr/dist/jsQR.js -c -m -o liveshare/vendor/jsQR.min.js
npx terser@5 node_modules/qrcode-generator/qrcode.js -c -m -o liveshare/vendor/qrcode.min.js
```
Globals exposed: `window.jsQR(...)` and `qrcode(...)`.

---

## 7. Known limitations

- **NAT traversal.** No relay (TURN) server, so a few strict/symmetric-NAT
  mobile networks may prevent the direct connection. Wi-Fi usually works.
  Adding a TURN server would fix this but reintroduces a server to run.
- **QR density.** The code is ~1250 chars → a version-25ish QR. It scans fine
  but benefits from screen brightness up and a steady hand ~15 cm away. The
  Send/paste fallback always works.
- **Backgrounding.** In a browser tab, sharing stops when the screen locks or
  the phone sleeps, and iOS Safari can't run a web app in the background at all.
  The **Android app** (`android/`) solves this on Android: the page calls
  `LiveShareHost.setSharing(true,…)` on connect, which starts a foreground
  service (location + microphone types, partial wake lock, ongoing
  notification) that keeps the WebView's JS — and so the sending — alive with
  the screen off. iOS has no equivalent. The session otherwise
  persists until someone taps Stop: the app holds a **screen wake lock**
  (`navigator.wakeLock`, re-acquired on `visibilitychange`) so the phone doesn't
  sleep and drop the link, sends a **10s keepalive** on the data channel, and
  treats a transient `disconnected` as "Reconnecting…" rather than tearing down
  (only `failed` is fatal). A hard failure still needs a fresh pair-up, because
  ICE restart can't be re-signalled without a server. The sharer keeps the
  ability to stop their own mic/location by design (consent).
- **Permissions.** Needs mic + location (sharer) and camera (to scan QR).
- **One-to-one.** Exactly two phones per session, by design.

---

## 8. Possible next steps (not started)

- A large one-tap **SOS/panic** mode (auto-start Share with everything on).
- Optional **TURN** server for reliability on strict networks.
- Show the watcher a **live embedded map** (currently an "Open in Maps" link +
  live coordinates) — would add a maps dependency.
- **Reconnect** handling if the connection drops.
- Install as a **PWA** (add a manifest + service worker for `liveshare/`).

---

## 9. Key links

- Live app (after merge): https://aditrikaushik.github.io/index/liveshare/
- Repo: https://github.com/AditriKaushik/index
- Open a PR for the current branch:
  https://github.com/AditriKaushik/index/pull/new/claude/gracious-brown-9bhpps
