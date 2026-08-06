const STORAGE_KEY = "sp_device_key";

/**
 * A stable per-browser-profile identifier, persisted in localStorage. This
 * is what the backend calls a "device" — it stands in for a hardware IMEI,
 * which browsers never expose (and modern mobile OSes gate behind
 * privileged, Play/App Store-restricted APIs). Clearing site data or using
 * a private window creates a "new" device, which is expected: the user
 * simply re-authenticates and, if they want, re-registers a PIN/passkey for
 * that browser profile.
 */
export function getOrCreateDeviceKey(): string {
  if (typeof window === "undefined") return "server";

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const key = crypto.randomUUID();
  window.localStorage.setItem(STORAGE_KEY, key);
  return key;
}

export function detectPlatform(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua)) return "macos";
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "web";
}

export function deviceLabel(): string {
  const platform = detectPlatform();
  const isMobile = /Mobi|Android/i.test(navigator.userAgent ?? "");
  const browser = /Chrome/i.test(navigator.userAgent)
    ? "Chrome"
    : /Firefox/i.test(navigator.userAgent)
      ? "Firefox"
      : /Safari/i.test(navigator.userAgent)
        ? "Safari"
        : "Browser";
  return `${browser} on ${platform}${isMobile ? " (mobile)" : ""}`;
}
