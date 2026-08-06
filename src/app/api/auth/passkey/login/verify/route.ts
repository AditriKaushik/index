import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { completeAuthentication } from "@/server/auth/webauthn-service";
import { createSession } from "@/server/auth/session-service";
import { setAuthCookies } from "@/server/auth/cookies";
import { logAudit } from "@/server/compliance/audit";
import { detectRegionFromHeaders, getClientIp } from "@/server/compliance/request-region";
import { handleRouteError } from "@/server/http";

const bodySchema = z.object({ deviceKey: z.string().min(8), response: z.any() });

export async function POST(req: NextRequest) {
  try {
    const { deviceKey, response } = bodySchema.parse(await req.json());
    const device = await completeAuthentication({ deviceKey, response });

    const { accessToken, refreshToken } = await createSession({
      userId: device.userId,
      deviceId: device.id,
    });
    await setAuthCookies(accessToken, refreshToken);
    await logAudit({
      userId: device.userId,
      action: "user.login",
      metadata: { via: "passkey" },
      ip: getClientIp(req.headers) ?? undefined,
      region: detectRegionFromHeaders(req.headers) ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
