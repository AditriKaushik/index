import { cookies } from "next/headers";

const ACCESS_COOKIE = "sp_access";
const REFRESH_COOKIE = "sp_refresh";
const isProd = process.env.NODE_ENV === "production";

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
  store.set(ACCESS_COOKIE, accessToken, { ...common, maxAge: 60 * 15 });
  store.set(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearAuthCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

export async function getAccessTokenCookie() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshTokenCookie() {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}
