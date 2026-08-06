import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/server/auth/current-user";
import { setDevicePin } from "@/server/auth/pin-service";
import { handleRouteError } from "@/server/http";

const bodySchema = z.object({ pin: z.string().min(4).max(8) });

export async function POST(req: NextRequest) {
  try {
    const { user, deviceId } = await requireCurrentUser();
    const { pin } = bodySchema.parse(await req.json());
    await setDevicePin({ userId: user.id, deviceId, pin });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
