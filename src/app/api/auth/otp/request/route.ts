import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { classifyIdentifier } from "@/server/auth/identifiers";
import { requestOtp } from "@/server/auth/otp-service";
import { handleRouteError, jsonError } from "@/server/http";

const bodySchema = z.object({
  identifier: z.string().min(3),
  purpose: z.enum(["SIGNUP", "LOGIN", "VERIFY_CONTACT"]),
  defaultCountry: z.string().length(2).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = bodySchema.parse(await req.json());
    const identifier = classifyIdentifier(body.identifier, body.defaultCountry);
    if (!identifier) {
      return jsonError("Enter a valid phone number or email address.");
    }

    await requestOtp({
      target: identifier.value,
      channel: identifier.channel,
      purpose: body.purpose,
    });

    return NextResponse.json({
      channel: identifier.channel,
      target: maskTarget(identifier.value, identifier.channel),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function maskTarget(value: string, channel: "SMS" | "EMAIL") {
  if (channel === "EMAIL") {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}
