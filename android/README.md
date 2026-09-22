# Live Share for Android

A thin Android wrapper around the [`liveshare/`](../liveshare) web app. It exists
for one reason a browser tab cannot manage: **keep sharing your location and
microphone with the screen locked or the phone asleep.**

## Why it's needed

A phone browser suspends a tab once the screen goes off, which stops the
location updates and the microphone — exactly when a person sharing for safety
needs them to keep going. This app runs a **foreground service** (with a
permanent "Live Share is sharing" notification) that keeps the process — and so
the WebView's JavaScript, the encryption and the sending — alive in the
background. On iOS there is no equivalent; only Android can do this.

## How it works

- The whole web app is bundled inside the APK and served over an internal
  `https://appassets.androidplatform.net/liveshare/…` address, so the crypto,
  microphone, camera and location APIs are all available (browsers require a
  secure origin). It opens instantly and works with no signal.
- When the page starts sharing, it calls a small JavaScript bridge
  (`LiveShareHost.setSharing(...)`) that starts the foreground service with the
  `location` + `microphone` service types and a partial wake lock. Stopping —
  from the app or the notification's **Stop** — tears it down.
- Nothing is hidden: the notification is shown the entire time it shares, and
  the sharer can always stop. This is a consent-based safety tool, not a covert
  one.

## Installing

Download the newest build (always the same link):
**https://github.com/AditriKaushik/index/releases/download/apk-latest/liveshare-release.apk**

Open it on the phone and Android will offer to install it (allow installing
from your browser the first time). Grant location, microphone and (for QR
scanning) camera when asked, plus notifications.

## Building locally

Needs JDK 17 and the Android SDK. From this directory:

```
./gradlew assembleDebug           # app/build/outputs/apk/debug/app-debug.apk
./gradlew assembleRelease         # signed with the debug key unless ANDROID_KEYSTORE_* are set
```

The build copies `../liveshare` (page + `vendor/`) into the app's assets, so
there is one source of truth. CI (`.github/workflows/build-apk.yml`) builds both
APKs on every push that touches `android/` or `liveshare/` and publishes them to
the rolling `apk-latest` release.

## Files

| File | What it is |
| --- | --- |
| `app/src/main/java/.../MainActivity.java` | The WebView + permission handling + JS bridge |
| `app/src/main/java/.../SharingService.java` | The foreground service that keeps sharing alive |
| `app/src/main/java/.../GuardianApp.java` | Creates the notification channel |
| `app/src/main/AndroidManifest.xml` | Permissions and the foreground-service declaration |
| `app/build.gradle` | Build config; copies `../liveshare` into assets |

> Note: some internal identifiers (Java package `org.mahendras.guardian`, the
> theme name, `GuardianApp`) still carry the project's earlier name. They are
> invisible to users — the app installs and shows as **Live Share** — and were
> left unchanged to avoid a risky rename.
