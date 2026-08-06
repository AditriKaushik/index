import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAuthenticationOptions } from "@/server/auth/webauthn-service";
import { handleRouteError } from "@/server/http";

const bodySchema = z.object({ deviceKey: z.string().min(8) });

export async function POST(req: NextRequest) {
  try {
    const { deviceKey } = bodySchema.parse(await req.json());
    const options = await buildAuthenticationOptions({ deviceKey });
    return NextResponse.json(options);
  } catch (error) {
    return handleRouteError(error);
  }
}
