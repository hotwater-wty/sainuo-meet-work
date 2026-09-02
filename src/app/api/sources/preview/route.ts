import { NextRequest, NextResponse } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { requireSession } from "@/lib/session-http";

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    if (!session.source) throw new AppError("SOURCE_REQUIRED", "请先导入文档", 409);
    return NextResponse.json(
      {
        preview: {
          title: session.source.metadata.title,
          outline: session.source.metadata.outline.slice(0, 12),
          chunks: session.source.chunks.slice(0, 24).map((chunk) => ({
            id: chunk.id,
            text: chunk.text,
            page: chunk.page,
            headingPath: chunk.headingPath,
          })),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
