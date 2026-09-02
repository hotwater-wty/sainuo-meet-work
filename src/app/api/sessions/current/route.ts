import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { requireSession } from "@/lib/session-http";
import { toSessionView } from "@/lib/session-store";

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    return NextResponse.json(
      { session: toSessionView(session) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
