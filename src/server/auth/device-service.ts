import { prisma } from "@/lib/prisma";
import { logAudit } from "../compliance/audit";

export async function upsertDevice(params: {
  userId: string;
  deviceKey: string;
  label?: string;
  platform?: string;
  userAgent?: string;
  ip?: string | null;
  region?: string | null;
}) {
  const device = await prisma.device.upsert({
    where: { deviceKey: params.deviceKey },
    create: {
      userId: params.userId,
      deviceKey: params.deviceKey,
      label: params.label,
      platform: params.platform,
      userAgent: params.userAgent,
      lastIp: params.ip ?? undefined,
      lastRegion: params.region ?? undefined,
    },
    update: {
      lastSeenAt: new Date(),
      lastIp: params.ip ?? undefined,
      lastRegion: params.region ?? undefined,
      label: params.label,
      userAgent: params.userAgent,
    },
  });

  await logAudit({
    userId: params.userId,
    action: "device.seen",
    metadata: { deviceId: device.id, platform: params.platform },
    ip: params.ip ?? undefined,
    region: params.region ?? undefined,
  });

  return device;
}

/** All data tied to a device stays scoped to the user who owns it — a
 * device record (and everything hung off it: sessions, passkeys, the local
 * PIN) can only ever be read or revoked by its owning user. */
export async function assertDeviceOwnedByUser(deviceId: string, userId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || device.userId !== userId) {
    throw new Error("Device not found for this user.");
  }
  return device;
}
