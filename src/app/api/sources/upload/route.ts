import { NextRequest, NextResponse } from "next/server";
import { AppError, errorResponse } from "@/lib/errors";
import { assertSameOrigin, requireSession } from "@/lib/session-http";
import { sessionStore, toSessionView } from "@/lib/session-store";
import { parseUploadedFile } from "@/lib/source";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = requireSession(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("FILE_REQUIRED", "请选择要导入的文件");
    const replace = form.get("replace") === "true";
    const source = await parseUploadedFile(file);
    sessionStore.replaceSource(session, source, replace);
    return NextResponse.json({ session: toSessionView(session) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
