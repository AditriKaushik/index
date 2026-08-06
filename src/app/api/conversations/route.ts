import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUser } from "@/server/auth/current-user";
import { createConversation, listConversationsForUser } from "@/server/chat/service";
import { handleRouteError } from "@/server/http";

export async function GET() {
  try {
    const { user } = await requireCurrentUser();
    const conversations = await listConversationsForUser(user.id);
    return NextResponse.json({ conversations });
  } catch (error) {
    return handleRouteError(error);
  }
}

const bodySchema = z.object({
  participantIds: z.array(z.string()).min(1),
  title: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireCurrentUser();
    const { participantIds, title } = bodySchema.parse(await req.json());
    const conversation = await createConversation({
      creatorId: user.id,
      participantIds,
      title,
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    return handleRouteError(error);
  }
}
