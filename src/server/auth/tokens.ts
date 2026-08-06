import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { env } from "@/lib/env";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenPayload {
  sub: string; // userId
  deviceId: string;
  sessionId: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret(), { expiresIn: ACCESS_TOKEN_TTL });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret()) as AccessTokenPayload;
}

/** Opaque, high-entropy refresh token. Only its hash is persisted (see crypto.ts). */
export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function refreshTokenExpiry(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
}
