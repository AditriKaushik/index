import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";

export async function GET() {
  const ctx = await getCurrentUser();
  if (!ctx) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: ctx.user.id,
      displayName: ctx.user.displayName,
      email: ctx.user.email,
      phone: ctx.user.phone,
      region: ctx.user.region,
    },
    deviceId: ctx.deviceId,
  });
}
