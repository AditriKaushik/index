import { NextResponse } from "next/server";
import { getRefreshTokenCookie, setAuthCookies, clearAuthCookies } from "@/server/auth/cookies";
import { rotateSession } from "@/server/auth/session-service";
import { jsonError } from "@/server/http";

export async function POST() {
  const refreshToken = await getRefreshTokenCookie();
  if (!refreshToken) return jsonError("No session to refresh.", 401);

  const rotated = await rotateSession(refreshToken);
  if (!rotated) {
    await clearAuthCookies();
    return jsonError("Session expired. Please sign in again.", 401);
  }

  await setAuthCookies(rotated.accessToken, rotated.refreshToken);
  return NextResponse.json({ ok: true });
}
