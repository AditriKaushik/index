import { prisma } from "@/lib/prisma";
import { hashSecret, verifySecret } from "./crypto";
import { assertDeviceOwnedByUser } from "./device-service";

const PIN_PATTERN = /^\d{4,8}$/;

export class PinError extends Error {}

export async function setDevicePin(params: { userId: string; deviceId: string; pin: string }) {
  if (!PIN_PATTERN.test(params.pin)) {
    throw new PinError("PIN must be 4 to 8 digits.");
  }
  await assertDeviceOwnedByUser(params.deviceId, params.userId);

  const pinHash = await hashSecret(params.pin);
  await prisma.device.update({
    where: { id: params.deviceId },
    data: { pinHash, trusted: true },
  });
}

export async function verifyDevicePin(params: { deviceKey: string; pin: string }) {
  const device = await prisma.device.findUnique({ where: { deviceKey: params.deviceKey } });
  if (!device || !device.pinHash) return null;

  const valid = await verifySecret(params.pin, device.pinHash);
  return valid ? device : null;
}
