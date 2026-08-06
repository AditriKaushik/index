import bcrypt from "bcryptjs";
import { randomInt, createHash } from "crypto";

const SALT_ROUNDS = 12;

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/** Generates a numeric OTP code, e.g. "482913". */
export function generateOtpCode(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(randomInt(min, max + 1));
}

/**
 * Refresh tokens are opaque random strings; we only ever store their SHA-256
 * digest so a leaked database can't be used to forge sessions.
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
