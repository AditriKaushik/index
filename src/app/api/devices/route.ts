import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth/current-user";
import { handleRouteError } from "@/server/http";

export async function GET() {
  try {
    const { user, deviceId } = await requireCurrentUser();
    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        label: true,
        platform: true,
        lastRegion: true,
        lastSeenAt: true,
        trusted: true,
        createdAt: true,
        pinHash: true,
        passkeys: { select: { id: true } },
      },
      orderBy: { lastSeenAt: "desc" },
    });

    return NextResponse.json({
      currentDeviceId: deviceId,
      devices: devices.map((d) => ({
        id: d.id,
        label: d.label,
        platform: d.platform,
        lastRegion: d.lastRegion,
        lastSeenAt: d.lastSeenAt,
        trusted: d.trusted,
        createdAt: d.createdAt,
        hasPin: Boolean(d.pinHash),
        hasPasskey: d.passkeys.length > 0,
        isCurrent: d.id === deviceId,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
