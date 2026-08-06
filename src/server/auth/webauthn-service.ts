import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type VerifiedAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { assertDeviceOwnedByUser } from "./device-service";

const CHALLENGE_COOKIE = "sp_webauthn_challenge";

async function stashChallenge(challenge: string) {
  const store = await cookies();
  store.set(CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 5,
  });
}

async function popChallenge(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(CHALLENGE_COOKIE)?.value ?? null;
  store.delete(CHALLENGE_COOKIE);
  return value;
}

export async function buildRegistrationOptions(params: {
  userId: string;
  userName: string;
  deviceId: string;
}) {
  await assertDeviceOwnedByUser(params.deviceId, params.userId);

  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId: params.userId },
  });

  const options = await generateRegistrationOptions({
    rpID: env.webauthnRpId(),
    rpName: env.webauthnRpName(),
    userName: params.userName,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((pk) => ({ id: pk.credentialId })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      // Biometric / device-native authenticator, not a roaming security key.
      authenticatorAttachment: "platform",
    },
  });

  await stashChallenge(options.challenge);
  return options;
}

export async function completeRegistration(params: {
  userId: string;
  deviceId: string;
  response: RegistrationResponseJSON;
}) {
  const expectedChallenge = await popChallenge();
  if (!expectedChallenge) throw new Error("Registration challenge expired. Try again.");

  const verification: VerifiedRegistrationResponse = await verifyRegistrationResponse({
    response: params.response,
    expectedChallenge,
    expectedOrigin: env.webauthnOrigin(),
    expectedRPID: env.webauthnRpId(),
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Passkey registration could not be verified.");
  }

  const { credential } = verification.registrationInfo;

  await prisma.passkey.create({
    data: {
      userId: params.userId,
      deviceId: params.deviceId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports?.join(","),
    },
  });

  await prisma.device.update({
    where: { id: params.deviceId },
    data: { trusted: true },
  });
}

export async function buildAuthenticationOptions(params: { deviceKey: string }) {
  const device = await prisma.device.findUnique({
    where: { deviceKey: params.deviceKey },
    include: { passkeys: true },
  });

  if (!device || device.passkeys.length === 0) {
    throw new Error("No passkey registered for this device.");
  }

  const options = await generateAuthenticationOptions({
    rpID: env.webauthnRpId(),
    userVerification: "preferred",
    allowCredentials: device.passkeys.map((pk) => ({ id: pk.credentialId })),
  });

  await stashChallenge(options.challenge);
  return options;
}

export async function completeAuthentication(params: {
  deviceKey: string;
  response: AuthenticationResponseJSON;
}) {
  const expectedChallenge = await popChallenge();
  if (!expectedChallenge) throw new Error("Sign-in challenge expired. Try again.");

  const device = await prisma.device.findUnique({
    where: { deviceKey: params.deviceKey },
    include: { passkeys: true },
  });
  if (!device) throw new Error("Unknown device.");

  const passkey = device.passkeys.find((pk) => pk.credentialId === params.response.id);
  if (!passkey) throw new Error("Passkey not recognized for this device.");

  const verification: VerifiedAuthenticationResponse = await verifyAuthenticationResponse({
    response: params.response,
    expectedChallenge,
    expectedOrigin: env.webauthnOrigin(),
    expectedRPID: env.webauthnRpId(),
    credential: {
      id: passkey.credentialId,
      publicKey: new Uint8Array(passkey.publicKey),
      counter: Number(passkey.counter),
      transports: passkey.transports?.split(",") as never,
    },
  });

  if (!verification.verified) {
    throw new Error("Passkey sign-in could not be verified.");
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: BigInt(verification.authenticationInfo.newCounter) },
  });

  return device;
}
