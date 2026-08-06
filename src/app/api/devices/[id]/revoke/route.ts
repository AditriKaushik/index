import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth/current-user";
import { assertDeviceOwnedByUser } from "@/server/auth/device-service";
import { revokeAllSessionsForDevice } from "@/server/auth/session-service";
import { logAudit } from "@/server/compliance/audit";
import { handleRouteError } from "@/server/http";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireCurrentUser();
    const { id } = await params;
    await assertDeviceOwnedByUser(id, user.id);

    await revokeAllSessionsForDevice(id);
    await prisma.device.update({ where: { id }, data: { pinHash: null } });
    await prisma.passkey.deleteMany({ where: { deviceId: id } });
    await logAudit({ userId: user.id, action: "device.revoke", metadata: { deviceId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
