# Architecture & Roadmap

This is phase 1 of a multi-modal social platform: authenticated real-time
text chat, built on an auth/compliance foundation designed to extend to
audio and video calling later without rework. This document explains what
exists, why it's built this way, what's deliberately deferred, and the
known gaps to close before any real-world launch.

## Stack

- **Next.js 16 (App Router) + TypeScript** — single codebase serving web on
  any device; a React Native client could reuse the same API and auth
  contracts later if a native app is wanted.
- **Custom Node server** (`server.ts`) wrapping Next's request handler +
  **Socket.io**, because real-time chat needs a persistent connection that
  Next's serverless-style API routes don't provide.
- **PostgreSQL + Prisma** for all persistent data (`prisma/schema.prisma`
  is the source of truth for the data model).
- **WebAuthn** (`@simplewebauthn/*`) for passkey/biometric login.

## Auth model

### Why phone / email / OTP instead of IMEI

The request called for IMEI-based login. In practice:

- Browsers never expose IMEI — there is no web API for it.
- Modern Android restricts `getDeviceId()`/IMEI reads to system/carrier
  apps; Play Store apps have been blocked from reading it for years.
- iOS has never exposed it to third-party apps.

So instead, sign-up/sign-in uses **phone number or email + a one-time
code** (`src/server/auth/otp-service.ts`, `identifiers.ts`), and each
browser/app install gets a **device identity** — a random UUID generated
client-side and persisted in local storage (`src/lib/device.ts`), sent to
the server on every auth call and stored as a `Device` row
(`prisma/schema.prisma`). This `Device` is what "the device you're logged
in on" means throughout the app: it's what a PIN or passkey binds to, and
what data-export/erasure and "revoke this device" act on. It fills the
same *role* IMEI would have (a stable per-install identity used to scope
local credentials and session state) without relying on an API that
doesn't exist for this stack.

OTP delivery is pluggable (`src/server/auth/otp-delivery.ts`) — the
default `console` provider just logs the code for local development;
swap in Twilio/SNS/SES/etc. per deployment.

### Quick relogin: PIN and biometrics

Once a device has done a full OTP login, it can register:

- **A local PIN** (`src/server/auth/pin-service.ts`) — 4–8 digits, hashed
  with bcrypt, scoped to that one `Device` row. A PIN never grants access
  from a device it wasn't set on.
- **A passkey** (`src/server/auth/webauthn-service.ts`) — standard
  WebAuthn registration/assertion, using the platform authenticator
  (Face ID / Touch ID / Windows Hello / Android biometrics) rather than a
  roaming security key, and likewise scoped to the device it was
  registered on.

Both let a user skip OTP on return visits from a device they've already
approved, while a brand-new device still needs the full phone/email flow.

### Sessions

Access tokens are short-lived JWTs (15 min); refresh tokens are opaque
random strings, stored server-side only as a SHA-256 hash
(`src/server/auth/session-service.ts`), rotated on every refresh. Both
live in `httpOnly` cookies so they're inaccessible to page JavaScript
(mitigates XSS token theft). Settings → **Devices** lets a user see every
device with an active session and revoke any of them, which immediately
kills that device's sessions, PIN, and passkeys server-side.

## "Data stays with the device/account it's logged into"

Concretely, today that means:

- All chat history, device records, and credentials are scoped by
  `userId`/`deviceId` foreign keys — there's no cross-account read path.
- A PIN or passkey registered on device A cannot be used from device B.
- Revoking a device invalidates its sessions, PIN, and passkeys
  server-side, immediately.
- Data export and erasure (below) operate strictly on the requesting
  user's own records.

What this does **not** yet mean: messages are not end-to-end encrypted, so
the server (and its operator) can read message content at rest. If the
intent behind "data stays with the user" extends to *the platform
operator can't read it either*, that requires E2EE (e.g. the Signal
protocol / MLS) with key material held client-side — a substantial follow-
up project, not a checkbox on top of this schema.

## Compliance framework (not a legal guarantee)

`src/server/compliance/` implements the engineering *hooks* that data
protection laws generally require, without claiming to be pre-validated
for every jurisdiction:

- **`regions.ts`** — a ruleset per region (minimum age, required consent
  items, whether data residency is expected) with a conservative
  GDPR-style default for any region without a specific entry. Only a
  handful of regions (EEA, California, India, Brazil) have dedicated
  entries as examples; every other region falls back to the default.
- **`request-region.ts`** — best-effort region detection from CDN/edge
  headers (`x-vercel-ip-country`, `cf-ipcountry`), never a raw IP lookup
  done in-app. Users can see/override their declared region in principle;
  the UI for changing it post-signup isn't built yet.
- **`consent.ts`** — records itemized, versioned consent per policy
  (`ConsentRecord`), enforced against the region's required list at
  signup.
- **`data-requests.ts`** — implements **export** (a JSON bundle of
  profile, devices, consents, and authored messages) and **erasure**
  (scrubs identifying fields, revokes all sessions/devices/passkeys, and
  soft-deletes the content of messages the user sent — the message *shell*
  is kept so other members' conversation history isn't corrupted, which is
  a common pattern for GDPR/CCPA erasure in group messaging products).
- **`audit.ts`** — an append-only log of security-relevant actions
  (login, device seen, data export/erase, device revoke).

**Before operating in any specific country, have local counsel review**
the relevant `RegionRules` entry (or add one) — age of consent, required
disclosures, and data residency expectations vary by country and change
over time in ways this file cannot track on its own.

## Real-time chat

`src/server/chat/service.ts` holds the DB-backed operations (list/create
conversations, fetch/send messages, mark-read); `socket-server.ts` wraps
them for real-time delivery over Socket.io, authenticating each socket
connection off the same `httpOnly` access-token cookie used by REST calls.
REST endpoints (`/api/conversations`, `/api/conversations/[id]/messages`)
handle everything that isn't inherently real-time (listing, history,
starting a new conversation, searching users).

## What's deliberately not built yet

- **Audio/video calling.** The message schema already has `AUDIO`/`VIDEO`
  message types, and the chat UI has (disabled) call buttons as a visible
  placeholder. Building it means: WebRTC on the client, a signaling
  channel (the existing Socket.io connection can carry offer/answer/ICE
  messages), and a TURN server for the ~15–20% of connections that can't
  do peer-to-peer NAT traversal (e.g. self-hosted `coturn`, or a hosted
  TURN provider). Group calls beyond a handful of participants need an SFU
  (e.g. LiveKit, mediasoup) rather than a peer mesh.
- **Push notifications**, read receipts beyond the current conversation
  view, message search, media upload/CDN storage (messages currently only
  carry a `mediaUrl` string — there's no upload endpoint yet), content
  moderation/reporting, and rate limiting on auth endpoints beyond the
  30-second OTP resend cooldown and 5-attempt cap.
- **Automated tests.** Verified manually end-to-end (signup → consent →
  chat → PIN relogin → data export, on both desktop and mobile viewport
  widths) during development; there's no test suite yet.
- **Native mobile apps.** The web app is responsive and works on mobile
  browsers, but doesn't get app-store distribution, push notifications, or
  OS-level biometric prompts outside what WebAuthn already provides in a
  mobile browser.

## Local development

```bash
npm install
npx prisma migrate dev   # requires a running Postgres; see .env
npm run dev              # custom server on http://localhost:3000
```

OTP codes are logged to the console by the default dev provider — check
the terminal running `npm run dev` for `[dev-otp] ... your code is ...`.
