import { prisma } from "@/lib/prisma";
import { getRegionRules } from "./regions";

export async function recordConsent(params: {
  userId: string;
  region: string;
  consents: Record<string, boolean>;
}) {
  const rules = getRegionRules(params.region);
  const missing = rules.requiredConsents.filter((c) => !params.consents[c.key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required consent(s): ${missing.map((c) => c.label).join(", ")}`
    );
  }

  await prisma.$transaction(
    Object.entries(params.consents).map(([key, granted]) =>
      prisma.consentRecord.create({
        data: {
          userId: params.userId,
          policyKey: key,
          policyVersion: "v1",
          region: params.region,
          granted,
        },
      })
    )
  );
}
