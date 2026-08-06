import { NextRequest, NextResponse } from "next/server";
import { detectRegionFromHeaders } from "@/server/compliance/request-region";
import { getRegionRules } from "@/server/compliance/regions";

export async function GET(req: NextRequest) {
  const detected = detectRegionFromHeaders(req.headers);
  const rules = getRegionRules(detected);
  return NextResponse.json({ detectedRegion: detected, rules });
}
