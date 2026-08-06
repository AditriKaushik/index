import { prisma } from "@/lib/prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  region?: string;
}) {
  await prisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      metadata: params.metadata as never,
      ip: params.ip,
      region: params.region,
    },
  });
}
