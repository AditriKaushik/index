import { prisma } from "@/lib/prisma";
import type { OtpChannel, OtpPurpose } from "@/generated/prisma/client";
import { generateOtpCode, hashSecret, verifySecret } from "./crypto";
import { getOtpProvider } from "./otp-delivery";

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;

export class OtpError extends Error {}

export async function requestOtp(params: {
  target: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  userId?: string;
}): Promise<void> {
  const recent = await prisma.otpCode.findFirst({
    where: { target: params.target, purpose: params.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new OtpError("Please wait before requesting another code.");
  }

  const code = generateOtpCode();
  const codeHash = await hashSecret(code);

  await prisma.otpCode.create({
    data: {
      target: params.target,
      channel: params.channel,
      purpose: params.purpose,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
      userId: params.userId,
    },
  });

  const provider = getOtpProvider();
  if (params.channel === "SMS") {
    await provider.sendSms(params.target, code);
  } else {
    await provider.sendEmail(params.target, code);
  }
}

export async function verifyOtp(params: {
  target: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<boolean> {
  const record = await prisma.otpCode.findFirst({
    where: { target: params.target, purpose: params.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) throw new OtpError("No pending code for this contact. Request a new one.");
  if (record.expiresAt < new Date()) throw new OtpError("This code has expired.");
  if (record.attempts >= MAX_ATTEMPTS) {
    throw new OtpError("Too many attempts. Request a new code.");
  }

  const valid = await verifySecret(params.code, record.codeHash);

  if (!valid) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
