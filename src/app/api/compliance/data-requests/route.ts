import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/server/auth/current-user";
import { buildDataExport, eraseUserData } from "@/server/compliance/data-requests";
import { clearAuthCookies } from "@/server/auth/cookies";
import { handleRouteError } from "@/server/http";

const bodySchema = z.object({ type: z.enum(["EXPORT", "DELETE"]) });

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCurrentUser();
    const { type } = bodySchema.parse(await req.json());

    if (type === "EXPORT") {
      const bundle = await buildDataExport(user.id);
      return NextResponse.json({ type, export: bundle });
    }

    await eraseUserData(user.id);
    await clearAuthCookies();
    return NextResponse.json({ type, ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
