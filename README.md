# index

A few small, self-contained web apps published from this repository, plus one
Cloudflare Worker that backs them.

| App | What it is |
| --- | --- |
| [`guardian/`](guardian/) | **Guardian** — share your live location, voice and camera with people you trust. One tap to start, one tap to stop, end-to-end encrypted. |
| [`android/`](android/) | Guardian as an installable Android app, so sharing keeps running with the screen off. [Download the APK](https://github.com/AditriKaushik/index/releases/download/apk-latest/guardian-release.apk) — the link always points at the newest build. |
| `trade-decision.html` | NSE intraday trade-decision framework, calculators and journal |
| `index.html` | The ₹1 lakh NSE intraday framework write-up |

Everything is static and served by GitHub Pages. The `worker/` directory holds
a single Cloudflare Worker serving both the trade tool's quote proxy and
Guardian's encrypted relay; see each app's README for setup.
