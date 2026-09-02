import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { skipNoteDraft } from "@/lib/note-service";
import { assertSameOrigin, requireSession } from "@/lib/session-http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const { stageId } = await context.params;
    return NextResponse.json({ session: skipNoteDraft(session, stageId) });
  } catch (error) {
    return errorResponse(error);
  }
}
