# index

A few small, self-contained web apps published from this repository, plus one
Cloudflare Worker that backs them.

| App | What it is |
| --- | --- |
| [`liveshare/`](liveshare/) | **Live Share** — share your live location and voice with one person you trust, end-to-end encrypted. One web page, no account, no server. |
| `trade-decision.html` | NSE intraday trade-decision framework, calculators and journal |
| `index.html` | The ₹1 lakh NSE intraday framework write-up |

Everything is static and served by GitHub Pages. The `worker/` directory holds
a single Cloudflare Worker serving the trade tool's quote proxy; see its README
for setup. (Live Share needs no server — the two phones connect directly.)
