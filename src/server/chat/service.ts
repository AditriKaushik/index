import { prisma } from "@/lib/prisma";

export class ChatError extends Error {}

export async function assertMembership(conversationId: string, userId: string) {
  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) throw new ChatError("You are not a member of this conversation.");
  return membership;
}

export async function listConversationsForUser(userId: string) {
  const memberships = await prisma.conversationMember.findMany({
    where: { userId },
    include: {
      conversation: {
        include: {
          members: { include: { user: { select: { id: true, displayName: true } } } },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { conversation: { updatedAt: "desc" } },
  });

  return memberships.map((m) => ({
    id: m.conversation.id,
    isGroup: m.conversation.isGroup,
    title: m.conversation.title,
    members: m.conversation.members.map((mem) => mem.user),
    lastMessage: m.conversation.messages[0] ?? null,
    lastReadAt: m.lastReadAt,
    updatedAt: m.conversation.updatedAt,
  }));
}

export async function createConversation(params: {
  creatorId: string;
  participantIds: string[];
  title?: string;
}) {
  const memberIds = Array.from(new Set([params.creatorId, ...params.participantIds]));
  if (memberIds.length < 2) {
    throw new ChatError("A conversation needs at least one other participant.");
  }

  const isGroup = memberIds.length > 2;

  if (!isGroup) {
    const existing = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        members: { every: { userId: { in: memberIds } } },
        AND: memberIds.map((id) => ({ members: { some: { userId: id } } })),
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) return existing;
  }

  return prisma.conversation.create({
    data: {
      isGroup,
      title: params.title,
      members: {
        create: memberIds.map((userId) => ({
          userId,
          role: userId === params.creatorId ? "OWNER" : "MEMBER",
        })),
      },
    },
    include: { members: true },
  });
}

export async function getMessages(conversationId: string, userId: string, before?: Date) {
  await assertMembership(conversationId, userId);

  return prisma.message.findMany({
    where: { conversationId, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { sender: { select: { id: true, displayName: true } } },
  });
}

export async function createMessage(params: {
  conversationId: string;
  senderId: string;
  type?: "TEXT" | "AUDIO" | "VIDEO" | "IMAGE" | "FILE";
  body?: string;
  mediaUrl?: string;
}) {
  await assertMembership(params.conversationId, params.senderId);
  if (!params.body && !params.mediaUrl) {
    throw new ChatError("A message needs text or media.");
  }

  const message = await prisma.message.create({
    data: {
      conversationId: params.conversationId,
      senderId: params.senderId,
      type: params.type ?? "TEXT",
      body: params.body,
      mediaUrl: params.mediaUrl,
    },
    include: { sender: { select: { id: true, displayName: true } } },
  });

  await prisma.conversation.update({
    where: { id: params.conversationId },
    data: { updatedAt: new Date() },
  });

  return message;
}

export async function markRead(conversationId: string, userId: string) {
  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}
