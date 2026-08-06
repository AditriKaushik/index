/**
 * Best-effort region detection from the incoming request. Real geolocation
 * is provided by the edge/CDN layer (Vercel, Cloudflare, etc.) via headers —
 * this never guesses from IP itself. Falls back to the user's declared
 * region, then to the DEFAULT ruleset. Users can always override the
 * detected region in account settings; detection only pre-fills a sensible
 * default and must never silently override an explicit user choice.
 */
export function detectRegionFromHeaders(headers: Headers): string | null {
  const candidates = [
    headers.get("x-vercel-ip-country"),
    headers.get("cf-ipcountry"),
    headers.get("x-appengine-country"),
  ];

  const found = candidates.find((value) => value && value !== "XX");
  return found ?? null;
}

export function getClientIp(headers: Headers): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  return headers.get("x-real-ip");
}
