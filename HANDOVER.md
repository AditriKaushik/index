# Handover — Live Share

Last updated: 2026-09-22

This document is a handover for the **Live Share** web app and the surrounding
`index` repository. It explains what exists, how it works, how to run and test
it, how it deploys, and what is left to do.

---

## 1. What this project is

**Live Share** (`liveshare/`) is a tiny, single-page web app that lets one
person share their **live location** and **live microphone** with one trusted
person, **end-to-end encrypted**, with **no account and no server**. The two
phones connect directly (peer-to-peer over WebRTC). It replaced an earlier,
much heavier app called *Guardian* (which used a Cloudflare relay, a group
model, camera sharing, and a native Android wrapper) — all of that was removed.

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
├─ worker/index.js            # Cloudflare Worker: Paytm Money quote proxy (trade tool only)
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

Live Share needs **no** Worker. The Worker and `wrangler.toml` are only for the
NSE trade tool; Guardian's relay, Durable Object binding and TURN config were
stripped out of them.

---

## 4. How Live Share works

### Roles
On open, the user types a **secret word** and taps **Share** (sends location +
mic) or **Watch** (receives). Everything is in `liveshare/index.html`.

### Pairing (serverless)
Standard WebRTC needs the two peers to exchange an SDP "offer" and "answer".
With no signaling server, they are exchanged as **pairing codes**:

1. Sharer creates an offer, waits for ICE gathering to finish (non-trickle),
   and turns it into an **invite code**.
2. Watcher ingests the invite, creates an answer, and produces a **reply code**.
3. Sharer ingests the reply → connected.

Codes can be exchanged three ways (all supported):
- **QR (default):** each side renders its code as a QR; the other side taps
  **Scan** and reads it with the camera. No typing.
- **Send:** `navigator.share` (WhatsApp/SMS/etc.), with a clipboard fallback.
- **Paste:** a "Show code" toggle reveals the raw text box.

### Encryption
- The secret word → an **AES-256-GCM** key via **PBKDF2** (150k iterations,
  SHA-256, random 16-byte salt). The salt is carried in the code as
  `saltB64 : payloadB64`.
- The pairing codes are **compressed** (`deflate-raw`) then encrypted, so an
  intercepted code without the secret word is useless. Compression roughly
  halves the code (~2945 → ~1249 chars on a real offer).
- Live **location** messages on the WebRTC data channel are also AES-GCM
  encrypted per message.
- Live **voice** rides WebRTC media, which is encrypted by DTLS-SRTP between
  the two peers.
- Only server touched at runtime: Google's public **STUN** (`stun.l.google.com`)
  to help the peers find each other — it never sees location or audio.

### Key functions in `index.html`
- `deriveKey`, `sealBytes` / `openBytes`, `encryptText` / `decryptText`
- `deflate` / `inflate` (CompressionStream / DecompressionStream)
- `makeCode` / `readCode` — build/parse a pairing code (`salt : encrypted(compressed(sdp))`)
- `startSender`, `sendConnect`, `onSenderConnected`, `startMicMeter`
- `watchMake`, `onLocationMsg`
- `drawQR` (qrcode-generator), `startScan` / `stopScan` (jsQR + camera)
- `stopAll` — full teardown (stops tracks, watch, scanner; clears QR/codes)

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
