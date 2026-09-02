import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { assertSameOrigin, SESSION_COOKIE, sessionCookie } from "@/lib/session-http";
import { sessionStore, toSessionView } from "@/lib/session-store";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const existingId = request.cookies.get(SESSION_COOKIE)?.value;
    const session = (existingId && sessionStore.get(existingId)) || sessionStore.create();
    return NextResponse.json(
      { session: toSessionView(session) },
      { headers: { "Set-Cookie": sessionCookie(session.id), "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
