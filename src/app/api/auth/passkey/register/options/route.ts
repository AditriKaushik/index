import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/server/auth/current-user";
import { buildRegistrationOptions } from "@/server/auth/webauthn-service";
import { handleRouteError } from "@/server/http";

export async function POST() {
  try {
    const { user, deviceId } = await requireCurrentUser();
    const options = await buildRegistrationOptions({
      userId: user.id,
      userName: user.email ?? user.phone ?? user.displayName,
      deviceId,
    });
    return NextResponse.json(options);
  } catch (error) {
    return handleRouteError(error);
  }
}
