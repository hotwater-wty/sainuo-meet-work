import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { getModelClient } from "@/lib/model-client";
import { createNoteDraft } from "@/lib/note-service";
import { assertSameOrigin, requireSession } from "@/lib/session-http";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const { stageId } = await context.params;
    const result = await createNoteDraft(session, stageId, getModelClient());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
