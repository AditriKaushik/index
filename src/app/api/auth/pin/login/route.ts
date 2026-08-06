import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyDevicePin } from "@/server/auth/pin-service";
import { createSession } from "@/server/auth/session-service";
import { setAuthCookies } from "@/server/auth/cookies";
import { logAudit } from "@/server/compliance/audit";
import { detectRegionFromHeaders, getClientIp } from "@/server/compliance/request-region";
import { handleRouteError, jsonError } from "@/server/http";

const bodySchema = z.object({ deviceKey: z.string().min(8), pin: z.string().min(4).max(8) });

export async function POST(req: NextRequest) {
  try {
    const { deviceKey, pin } = bodySchema.parse(await req.json());
    const device = await verifyDevicePin({ deviceKey, pin });
    if (!device) return jsonError("Incorrect PIN.", 401);

    const { accessToken, refreshToken } = await createSession({
      userId: device.userId,
      deviceId: device.id,
    });
    await setAuthCookies(accessToken, refreshToken);
    await logAudit({
      userId: device.userId,
      action: "user.login",
      metadata: { via: "pin" },
      ip: getClientIp(req.headers) ?? undefined,
      region: detectRegionFromHeaders(req.headers) ?? undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
