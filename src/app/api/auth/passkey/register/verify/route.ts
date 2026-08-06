import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/server/auth/current-user";
import { completeRegistration } from "@/server/auth/webauthn-service";
import { handleRouteError } from "@/server/http";

export async function POST(req: NextRequest) {
  try {
    const { user, deviceId } = await requireCurrentUser();
    const response = await req.json();
    await completeRegistration({ userId: user.id, deviceId, response });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
