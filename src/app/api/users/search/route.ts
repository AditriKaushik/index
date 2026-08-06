import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/server/auth/current-user";
import { handleRouteError } from "@/server/http";

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireCurrentUser();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json({ users: [] });

    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        status: "ACTIVE",
        OR: [
          { displayName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      select: { id: true, displayName: true, email: true, phone: true },
      take: 10,
    });

    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
