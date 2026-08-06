import { prisma } from "@/lib/prisma";
import { sha256 } from "./crypto";
import {
  generateRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from "./tokens";

export async function createSession(params: { userId: string; deviceId: string }) {
  const refreshToken = generateRefreshToken();

  const session = await prisma.session.create({
    data: {
      userId: params.userId,
      deviceId: params.deviceId,
      refreshTokenHash: sha256(refreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken({
    sub: params.userId,
    deviceId: params.deviceId,
    sessionId: session.id,
  });

  return { accessToken, refreshToken, session };
}

export async function rotateSession(refreshToken: string) {
  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: sha256(refreshToken) },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return null;
  }

  const nextRefreshToken = generateRefreshToken();
  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: sha256(nextRefreshToken),
      expiresAt: refreshTokenExpiry(),
    },
  });

  const accessToken = signAccessToken({
    sub: updated.userId,
    deviceId: updated.deviceId,
    sessionId: updated.id,
  });

  return { accessToken, refreshToken: nextRefreshToken, session: updated };
}

export async function revokeSession(refreshToken: string) {
  await prisma.session.updateMany({
    where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessionsForDevice(deviceId: string) {
  await prisma.session.updateMany({
    where: { deviceId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
