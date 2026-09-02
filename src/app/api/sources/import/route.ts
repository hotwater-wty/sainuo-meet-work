import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchPublicSource } from "../../../../../experiments/p1/url";
import { errorResponse, AppError } from "@/lib/errors";
import { assertSameOrigin, requireSession } from "@/lib/session-http";
import { sessionStore, toSessionView } from "@/lib/session-store";
import { parseFetched } from "@/lib/source";

export const runtime = "nodejs";

const inputSchema = z.object({
  url: z.string().url("请输入有效的公开 URL").max(2_000),
  replace: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const input = inputSchema.parse(await request.json());
    let fetched;
    try {
      fetched = await fetchPublicSource(input.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "URL fetch failed";
      if (/private|local|reserved|credentials|only http/i.test(message)) {
        throw new AppError("UNSAFE_URL", "该地址不属于可导入的公开网络资源", 400);
      }
      throw new AppError("URL_FETCH_FAILED", "无法读取该地址，请检查页面是否公开且为静态内容", 422, true);
    }
    const source = await parseFetched(fetched);
    sessionStore.replaceSource(session, source, input.replace);
    return NextResponse.json({ session: toSessionView(session) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
