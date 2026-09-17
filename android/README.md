# Guardian for Android

An APK wrapper around the Guardian web app in [`../guardian`](../guardian).

## Why an APK at all

The website works, and for a short walk it is enough. The app exists for the one
thing a browser tab genuinely cannot do:

> **Sharing keeps running with the screen off and the phone in a pocket.**

A backgrounded browser tab gets its timers throttled and its location updates
paused, which is exactly when someone on the way home needs their position to
keep moving. The app holds a foreground service with the `location` type (and
`microphone` while voice is on) plus a partial wake lock for as long as a session
lasts, so the page keeps running and keeps sending.

Three smaller wins come with it:

- **It opens instantly and works with no signal.** The web app is copied into the
  APK at build time and served from inside it, so it does not depend on any site
  being up. `WebViewAssetLoader` serves those files over `https` from a virtual
  host, which is what makes geolocation, the camera, the microphone and WebCrypto
  available — a browser refuses all of them outside a secure context.
- **A permanent notification** while sharing, with its own *Stop sharing* button.
  It is not dismissible, so a session can never run unnoticed.
- **Share links open in the app**, not the browser, when they arrive by WhatsApp.

Everything else is the same code as the website — the encryption, the map, the
SOS button. The APK adds capability, never a second implementation.

## Getting the APK

**On the phone, one tap:**

> **https://github.com/AditriKaushik/index/releases/download/apk-latest/guardian-release.apk**

Open that on the phone and Android offers to install it — no GitHub login, no zip
to unpack. The first time, you have to allow installing apps from your browser.
The `apk-latest` tag is refreshed by every build, so the link never changes.

**From the Actions tab**, if you would rather have the exact APKs from one run:
every push touching `android/` or `guardian/` runs
[Build Guardian APK](../.github/workflows/build-apk.yml), and each run uploads a
`guardian-apk` artifact holding `guardian-debug.apk` and `guardian-release.apk`.
That route needs a GitHub login and arrives as a zip. `workflow_dispatch` lets
you build one on demand.

**Locally**, with a JDK 17 and the Android SDK installed:

```
cd android
./gradlew assembleRelease      # app/build/outputs/apk/release/app-release.apk
```

Nothing needs to be copied by hand: the build syncs `../guardian` into the app's
assets every time, so the APK and the website can never drift apart.

## Configure before you ship it

**`guardianPublicBase` in `gradle.properties` is the setting that matters.**

Inside the APK the page lives at a private address that means nothing to anyone
else, so share links are built from this public URL instead. It must point at a
deployed copy of `guardian/`:

```
guardianPublicBase=https://aditrikaushik.github.io/index/guardian/
```

Get this wrong and the app works perfectly for the person sharing while every
link they send is broken. It is also the URL in the `VIEW` intent filter in
`AndroidManifest.xml` — change both together if you host it elsewhere.

The relay address is *not* built in. It is entered once in ⚙ Settings and
remembered, and it travels inside every share link, so the people you send links
to never configure anything.

## Signing

With no keystore configured, the release APK is signed with the debug key. It
installs fine; it just cannot be upgraded later by a properly signed build. To
sign it for real, set four repository secrets and CI picks them up:

| Secret | What it is |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | your `.jks`, base64-encoded (`base64 -w0 guardian.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | keystore password |
| `ANDROID_KEY_ALIAS` | key alias inside the keystore |
| `ANDROID_KEY_PASSWORD` | password for that key |

Locally the same values come from the environment: `ANDROID_KEYSTORE_FILE`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

## Permissions, and why each one is asked for

| Permission | Used for |
| --- | --- |
| `ACCESS_FINE_LOCATION` | the position being shared; asked for at first launch |
| `RECORD_AUDIO`, `CAMERA` | only when you turn on Voice or Camera in the app |
| `FOREGROUND_SERVICE_LOCATION`, `FOREGROUND_SERVICE_MICROPHONE` | keeping the session alive with the screen off |
| `WAKE_LOCK` | the same |
| `POST_NOTIFICATIONS` | the notification that shows a session is running |
| `INTERNET` | reaching the relay |

There is no `ACCESS_BACKGROUND_LOCATION`: while a foreground service with the
location type is running, it is not needed, and asking for it would be asking for
more than the app uses. Backups are switched off, so a restored phone never comes
back with a live-looking session.

The camera pauses when the app is not on screen — Android reserves background
camera access for a much narrower set of apps, and working around that is not
something a safety app should be doing.

## Layout

| Path | What it is |
| --- | --- |
| `app/src/main/java/.../MainActivity.java` | the WebView, permissions, and the `GuardianHost` bridge |
| `app/src/main/java/.../SharingService.java` | foreground service + wake lock, alive only during a session |
| `app/src/main/java/.../GuardianApp.java` | the notification channel |
| `app/build.gradle` | build config, signing, and the `syncWebApp` task that embeds the web app |

The bridge is deliberately tiny — `isNativeApp()`, `publicBase()`,
`setSharing(...)`, and `window.__guardianStop()` going the other way. The web app
checks for it and degrades to plain browser behaviour when it is absent, so one
codebase serves both.
