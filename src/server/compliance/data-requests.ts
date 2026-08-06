import { prisma } from "@/lib/prisma";
import { logAudit } from "./audit";

export async function buildDataExport(userId: string) {
  const [user, devices, memberships, messages, consents] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.device.findMany({
      where: { userId },
      select: { id: true, label: true, platform: true, lastSeenAt: true, trusted: true, createdAt: true },
    }),
    prisma.conversationMember.findMany({ where: { userId }, include: { conversation: true } }),
    prisma.message.findMany({ where: { senderId: userId, deletedAt: null } }),
    prisma.consentRecord.findMany({ where: { userId } }),
  ]);

  await prisma.dataRequest.create({
    data: { userId, type: "EXPORT", status: "COMPLETED", completedAt: new Date() },
  });
  await logAudit({ userId, action: "data.export" });

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      region: user.region,
      createdAt: user.createdAt,
    },
    devices,
    conversations: memberships.map((m) => ({
      conversationId: m.conversationId,
      title: m.conversation.title,
      joinedAt: m.joinedAt,
    })),
    messagesAuthored: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      type: m.type,
      body: m.body,
      createdAt: m.createdAt,
    })),
    consents,
  };
}

/**
 * Honors an erasure request: personal identifiers are scrubbed and the
 * account is deactivated. Message *shells* are kept (not their content) so
 * conversations other members are part of aren't retroactively corrupted —
 * this mirrors how GDPR/CCPA erasure is commonly implemented in group
 * messaging products. Adjust per counsel's guidance for a given region.
 */
export async function eraseUserData(userId: string) {
  await prisma.$transaction([
    prisma.message.updateMany({
      where: { senderId: userId },
      data: { body: null, mediaUrl: null, deletedAt: new Date() },
    }),
    prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
    prisma.passkey.deleteMany({ where: { userId } }),
    prisma.device.updateMany({ where: { userId }, data: { pinHash: null, trusted: false } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        displayName: "Deleted user",
        email: null,
        phone: null,
        dateOfBirth: null,
        status: "DELETED",
      },
    }),
    prisma.dataRequest.create({
      data: { userId, type: "DELETE", status: "COMPLETED", completedAt: new Date() },
    }),
  ]);

  await logAudit({ userId, action: "data.erase" });
}
