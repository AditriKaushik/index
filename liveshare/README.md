# Live Share

Share your **live location** and **live voice** with one person you trust —
end-to-end encrypted, with no account and no server to run.

It is a single web page. Open the link on both phones and you are done.

## How to use it

1. Both people open the page and type **the same secret word**. That word is
   the key — agree on it in person or over a call, and don't send it in the
   same message as the code below.
2. One person taps **Share**, the other taps **Watch**.
3. The sharer's phone shows an **invite QR**. The watcher taps **Scan their
   invite** and points the camera at it. (If the phones aren't together, the
   sharer can tap **Send code** to send it over WhatsApp/SMS and the watcher
   pastes it instead — both work.)
4. The watcher's phone then shows a **reply QR**. The sharer taps **Scan their
   reply** and points at it (or the watcher sends the reply code back).
5. They're connected. The watcher now sees the sharer's location on a live map
   link and hears their microphone.

Either side can tap **Stop** at any time and nothing more is shared.

## Why it's private

- **End-to-end encrypted.** The secret word is turned into an AES-256-GCM key
  inside the browser (PBKDF2). The pairing codes are encrypted with it, and the
  location updates are encrypted with it. Voice travels directly between the two
  phones over WebRTC, which is itself encrypted (DTLS-SRTP). Anyone who copies a
  code but doesn't know the secret word gets only scrambled bytes.
- **No server, no account, no history.** The two phones talk to each other
  directly. Nothing about you is stored anywhere. (Google's public STUN server
  is used only to help the two phones find each other — it never sees your
  location or voice.)
- **Nothing hidden.** While a phone is sharing, it says so on screen with a red
  banner and a live microphone-level bar, and one tap stops it. There is no
  secret/background mode — this is for two people who both agreed to it, not for
  watching someone who didn't.

## Honest limits

Because there is no relay server, the two phones connect directly. On most
Wi-Fi and mobile networks that works. On a few strict networks the direct
connection can't form; if that happens, try again on Wi-Fi.

**Staying connected.** Once connected, the session stays live until someone
taps Stop — it does not time out. While a session is running the app holds a
screen **wake lock** so the phone doesn't sleep and drop the link, and sends a
small heartbeat every 10 seconds. Brief network wobbles show "Reconnecting…"
and recover on their own without re-pairing. Two things still end it: the page
being **fully closed** (both location and voice need the sharing page open —
on iOS a web app can't run in the background at all), and a **hard** network
failure, which needs a fresh pair-up. The sharer can always stop sharing their
own microphone and location — that is deliberate and cannot be taken away.

## Browser support

Works in Chrome, Edge, Samsung Internet and Safari (iOS 16.4+). It must be
opened over **https** — the location, microphone and encryption APIs are
switched off on insecure pages.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The whole app — UI, encryption, location, microphone, WebRTC, QR |
| `vendor/qrcode.min.js` | QR **encoder** (qrcode-generator, MIT) — draws the invite/reply QR |
| `vendor/jsQR.min.js` | QR **decoder** (jsQR, Apache-2.0) — reads a QR from the camera |

The two `vendor/` files are the only third-party code, both served from this
site (no CDN), so the app stays self-contained and works offline once loaded.
