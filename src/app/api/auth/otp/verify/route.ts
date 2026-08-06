import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { classifyIdentifier } from "@/server/auth/identifiers";
import { verifyOtp } from "@/server/auth/otp-service";
import { upsertDevice } from "@/server/auth/device-service";
import { createSession } from "@/server/auth/session-service";
import { setAuthCookies } from "@/server/auth/cookies";
import { detectRegionFromHeaders, getClientIp } from "@/server/compliance/request-region";
import { logAudit } from "@/server/compliance/audit";
import { handleRouteError, jsonError } from "@/server/http";

const bodySchema = z.object({
  identifier: z.string().min(3),
  purpose: z.enum(["SIGNUP", "LOGIN", "VERIFY_CONTACT"]),
  code: z.string().length(6),
  defaultCountry: z.string().length(2).optional(),
  displayName: z.string().min(1).max(80).optional(),
  deviceKey: z.string().min(8),
  platform: z.string().optional(),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const identifier = classifyIdentifier(body.identifier, body.defaultCountry);
    if (!identifier) return jsonError("Enter a valid phone number or email address.");

    const ok = await verifyOtp({
      target: identifier.value,
      purpose: body.purpose,
      code: body.code,
    });
    if (!ok) return jsonError("Incorrect code.", 401);

    const ip = getClientIp(req.headers);
    const region = detectRegionFromHeaders(req.headers);

    const isEmail = identifier.channel === "EMAIL";
    let user = isEmail
      ? await prisma.user.findUnique({ where: { email: identifier.value } })
      : await prisma.user.findUnique({ where: { phone: identifier.value } });

    if (!user) {
      if (body.purpose === "LOGIN") {
        return jsonError("No account found for this contact. Sign up first.", 404);
      }
      user = await prisma.user.create({
        data: {
          displayName: body.displayName ?? identifier.value.split("@")[0] ?? "New user",
          email: isEmail ? identifier.value : undefined,
          phone: isEmail ? undefined : identifier.value,
          emailVerifiedAt: isEmail ? new Date() : undefined,
          phoneVerifiedAt: isEmail ? undefined : new Date(),
          region: region ?? undefined,
        },
      });
      await logAudit({ userId: user.id, action: "user.signup", ip: ip ?? undefined, region: region ?? undefined });
    } else if (isEmail ? !user.emailVerifiedAt : !user.phoneVerifiedAt) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: isEmail ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
      });
    }

    const device = await upsertDevice({
      userId: user.id,
      deviceKey: body.deviceKey,
      platform: body.platform,
      userAgent: body.userAgent,
      ip,
      region,
    });

    const { accessToken, refreshToken } = await createSession({
      userId: user.id,
      deviceId: device.id,
    });
    await setAuthCookies(accessToken, refreshToken);
    await logAudit({ userId: user.id, action: "user.login", metadata: { via: "otp" }, ip: ip ?? undefined, region: region ?? undefined });

    return NextResponse.json({
      user: { id: user.id, displayName: user.displayName, email: user.email, phone: user.phone },
      device: { id: device.id, deviceKey: device.deviceKey },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
