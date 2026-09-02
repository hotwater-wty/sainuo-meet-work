import { NextRequest, NextResponse } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { getModelClient } from "@/lib/model-client";
import { assertSameOrigin, requireSession } from "@/lib/session-http";
import {
  executePreparedStage,
  finishStage,
  prepareStageAction,
  stageActionSchema,
} from "@/lib/stage-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const { id } = await context.params;
    const input = stageActionSchema.parse(await request.json());
    if (input.action === "finish") {
      return NextResponse.json({ session: finishStage(session, id) });
    }
    const prepared = prepareStageAction(session, id, input);
    const model = getModelClient();
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const event = (value: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
        };
        try {
          const completion = await executePreparedStage(prepared, model, (token) =>
            event({ type: "delta", text: token }),
          );
          event({ type: "complete", ...completion });
        } catch (error) {
          const appError =
            error instanceof AppError
              ? error
              : new AppError("STREAM_FAILED", "流式响应中断，请重试", 502, true);
          event({
            type: "error",
            error: { code: appError.code, message: appError.message, retryable: appError.retryable },
          });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
