import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUser } from "@/server/auth/current-user";
import { getMessages } from "@/server/chat/service";
import { handleRouteError } from "@/server/http";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireCurrentUser();
    const { id } = await params;
    const before = req.nextUrl.searchParams.get("before");
    const messages = await getMessages(id, user.id, before ? new Date(before) : undefined);
    return NextResponse.json({ messages });
  } catch (error) {
    return handleRouteError(error);
  }
}
