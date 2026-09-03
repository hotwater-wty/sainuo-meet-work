import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { assertSameOrigin, expiredSessionCookie, requireSession, SESSION_COOKIE } from "@/lib/session-http";
import { sessionStore, toSessionView } from "@/lib/session-store";

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

/**
 * 结束当前匿名临时会话。用于用户主动离开尚未完成的精读流程；不把旧会话伪装成可恢复的历史记录。
 */
export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const id = request.cookies.get(SESSION_COOKIE)?.value;
    if (id) sessionStore.delete(id);
    return new NextResponse(null, {
      status: 204,
      headers: { "Set-Cookie": expiredSessionCookie(), "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
