# index

Standalone, dependency-free HTML tools published from this repository. Each page is
self-contained — open the file and it works, offline included.

| Page | What it is |
| --- | --- |
| [`index.html`](index.html) | ₹1 lakh NSE intraday framework — cost and position-size calculators, daily rules, A-grade checklist, journal template. |
| [`trade-decision.html`](trade-decision.html) | Today's trade decision — a Yes / No / Marginal read on an intraday setup. Installable as a PWA. |
| [`content-ops.html`](content-ops.html) | Exam content operations blueprint — vacancy radar for Bank, SSC, Railway and State Police cycles, a cycle volume planner, the create → audit → correct → review → approve → publish pipeline, and the specification for the information dashboard that runs it. |

`worker/` holds a Cloudflare Worker that proxies broker quotes for the trading pages;
`sw.js` and `manifest.json` make the trading pages installable offline.
