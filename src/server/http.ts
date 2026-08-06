import { NextResponse } from "next/server";
import { UnauthorizedError } from "./auth/current-user";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof UnauthorizedError) {
    return jsonError("Unauthorized", 401);
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  console.error(error);
  return jsonError(message, 400);
}
