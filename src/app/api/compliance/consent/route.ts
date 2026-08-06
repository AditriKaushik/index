import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/server/auth/current-user";
import { recordConsent } from "@/server/compliance/consent";
import { prisma } from "@/lib/prisma";
import { handleRouteError } from "@/server/http";

const bodySchema = z.object({
  region: z.string().min(2),
  consents: z.record(z.string(), z.boolean()),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCurrentUser();
    const { region, consents } = bodySchema.parse(await req.json());

    await recordConsent({ userId: user.id, region, consents });
    if (user.region !== region) {
      await prisma.user.update({ where: { id: user.id }, data: { region } });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
