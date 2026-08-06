import { NextResponse } from "next/server";
import { clearAuthCookies, getRefreshTokenCookie } from "@/server/auth/cookies";
import { revokeSession } from "@/server/auth/session-service";

export async function POST() {
  const refreshToken = await getRefreshTokenCookie();
  if (refreshToken) await revokeSession(refreshToken);
  await clearAuthCookies();
  return NextResponse.json({ ok: true });
}
