import { NextRequest, NextResponse } from "next/server";
import { retrieveCitations } from "@/lib/citations";
import { AppError, errorResponse } from "@/lib/errors";
import { requireSession } from "@/lib/session-http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = requireSession(request);
    if (!session.source || !session.plan) throw new AppError("PLAN_REQUIRED", "请先生成阅读路线", 409);
    const { id } = await context.params;
    const stage = session.plan.stages.find((item) => item.id === id);
    if (!stage) throw new AppError("STAGE_NOT_FOUND", "阅读阶段不存在", 404);
    const result = retrieveCitations(
      session.source,
      [stage.title, stage.objective, ...stage.sourceScopes].join(" "),
    );
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
