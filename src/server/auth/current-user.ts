import { prisma } from "@/lib/prisma";
import { getAccessTokenCookie } from "./cookies";
import { verifyAccessToken } from "./tokens";

export async function getCurrentUser() {
  const token = await getAccessTokenCookie();
  if (!token) return null;

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === "DELETED") return null;
    return { user, deviceId: payload.deviceId, sessionId: payload.sessionId };
  } catch {
    return null;
  }
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
  }
}

export async function requireCurrentUser() {
  const ctx = await getCurrentUser();
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}
