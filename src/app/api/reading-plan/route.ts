import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppError, errorResponse } from "@/lib/errors";
import { getModelClient } from "@/lib/model-client";
import { generateReadingPlan, readerProfileSchema } from "@/lib/reading-plan";
import { assertSameOrigin, requireSession } from "@/lib/session-http";
import { toSessionView } from "@/lib/session-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const inputSchema = readerProfileSchema.extend({ replace: z.boolean().default(false) });

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    if (!session.source) throw new AppError("SOURCE_REQUIRED", "请先导入一份文档", 409);
    const input = inputSchema.parse(await request.json());
    if (session.plan && !input.replace) {
      throw new AppError("PLAN_EXISTS", "当前会话已有阅读路线，请确认后再重新生成", 409);
    }
    const profile = {
      goal: input.goal,
      familiarity: input.familiarity,
      focus: input.focus,
      selectedScope: input.selectedScope,
    };
    const plan = await generateReadingPlan(session.source, profile, getModelClient());
    session.profile = profile;
    session.plan = plan;
    session.notes = [];
    return NextResponse.json({ session: toSessionView(session) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
