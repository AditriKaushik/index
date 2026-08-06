import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

const emailSchema = z.string().email();

export function normalizeEmail(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  return emailSchema.safeParse(trimmed).success ? trimmed : null;
}

/** Normalizes any locally-formatted phone number to E.164, e.g. "+14155551234". */
export function normalizePhone(input: string, defaultCountry?: string): string | null {
  const parsed = parsePhoneNumberFromString(
    input,
    defaultCountry as never
  );
  if (!parsed || !parsed.isValid()) return null;
  return parsed.number;
}

export type ContactChannel = "SMS" | "EMAIL";

export function classifyIdentifier(
  input: string,
  defaultCountry?: string
): { channel: ContactChannel; value: string } | null {
  const email = normalizeEmail(input);
  if (email) return { channel: "EMAIL", value: email };

  const phone = normalizePhone(input, defaultCountry);
  if (phone) return { channel: "SMS", value: phone };

  return null;
}
