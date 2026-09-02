import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/errors";
import { resolveNoteDraft } from "@/lib/note-service";
import { assertSameOrigin, requireSession } from "@/lib/session-http";

const inputSchema = z.object({
  draftId: z.string().uuid("草稿 ID 无效"),
  action: z.enum(["accept", "skip"]),
  editedContent: z.string().max(20_000).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ stageId: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const { stageId } = await context.params;
    const input = inputSchema.parse(await request.json());
    return NextResponse.json({ session: resolveNoteDraft(session, stageId, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
