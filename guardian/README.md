# Guardian — live group sharing

A small private group where the people you trust — your family, a few friends —
can see each other live. Turn **Location**, **Voice** or **Camera** on for the
group once, and after that anyone in the group can look whenever they want. No
tapping "accept" every time; you granted it once, they can reach it any time.
Turn it off and no one can access it any more.

It is a web app, so there is nothing to install: make a group, send the link,
and it opens on whatever phone people already have. An [Android app](../android)
wraps the same page so your sharing keeps working with the screen off.

## How it works

1. **Make a group** (or open a link someone sent you). Everyone who opens the
   same link is in the same private group.
2. **Choose what you share.** Three switches — Location, Voice, Camera. On means
   the group can access it any time; off means no one can.
3. **See anyone.** Tap a member to see their live position on a map, and to hear
   or watch them if they have voice or camera on. Their phone serves it
   automatically, because they already turned it on for the group.

## What "any time" really means

Honest about the limits, because a safety app should be:

- **Location and voice** keep flowing while that person's Guardian is running.
  The [Android app](../android) keeps it running in the background with the
  screen off. In a plain browser the tab has to stay open.
- **Camera** works only while that person has Guardian on screen — phones never
  let a normal app use the camera in the background, and that is not something a
  safety app should try to defeat.
- If someone fully closes the app, nothing can reach their phone until they open
  it again.

## Privacy

- **End-to-end encrypted.** Each group has a random AES-256-GCM key generated in
  the browser and carried in the group link's fragment (after `#`), which
  browsers never send to a server. Location and the WebRTC handshake are
  encrypted before they leave the phone; voice and video go peer-to-peer. The
  relay only ever forwards ciphertext.
- **No accounts, no history, no database.** The relay knows a room id and passes
  scrambled bytes; it never sees who is in a group or where they are.
- **Nothing hidden.** Whatever you turn on, your own phone shows it (a live
  camera preview, and on Android an ongoing notification), and one tap turns it
  off. Guardian has no invisible mode — it is for people who agreed to be in a
  group together, not for watching someone who did not.
- **Treat the link like a key.** Anyone who has it can join the group. If it
  goes to the wrong person, make a new group and share that instead.

## Setup

The app is static (GitHub Pages serves it as-is) and needs one small relay
server — the Cloudflare Worker in this repo — to introduce phones to each other.

1. **Deploy the Worker** from the repo root:

   ```
   npx wrangler kv namespace create PM_KV     # if you have not already
   # put the printed id into wrangler.toml
   npx wrangler deploy
   ```

   It serves `/guardian/ws`, `/guardian/ice` and `/guardian/health`. The
   `SAFETY_ROOMS` Durable Object binding and its migration are already in
   `wrangler.toml`, and work on the Workers free plan.

2. **Point the app at it.** Open the app, tap ⚙ and paste the Worker address, or
   set `BUILTIN_RELAY` near the top of the script in `guardian/index.html` so it
   needs no setup. The address travels inside every group link, so people you
   invite never configure anything.

3. **Optional: a TURN server** for voice/video on strict mobile networks. Set
   `TURN_URL`, `TURN_USERNAME`, `TURN_CREDENTIAL` as Worker secrets. Location
   always works without it; `/guardian/health` reports whether one is set.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app — group UI, crypto, geolocation, WebRTC |
| `sw.js` | Service worker, caches the app shell for an instant, offline start |
| `manifest.webmanifest` | Home-screen install metadata |
| `icons/` | App icons |
| `../worker/guardian.js` | The relay: routes plus the `SafetyRoom` Durable Object (up to 12 per group) |
| `../android/` | The Android app that wraps this page |

## Browser support

Chrome, Edge and Samsung Internet on Android, and Safari on iOS 16.4+, support
what this needs. On Android the [APK](../android) is the better way to run it; on
iOS there is no way to keep a web app running in the background, so keep the
screen on when it matters.
