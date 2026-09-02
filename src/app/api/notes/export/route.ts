import { NextRequest } from "next/server";
import { errorResponse } from "@/lib/errors";
import { exportNotes } from "@/lib/export-notes";
import { requireSession } from "@/lib/session-http";

export async function GET(request: NextRequest) {
  try {
    const session = requireSession(request);
    const exported = exportNotes(session);
    return new Response(exported.content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="reading-notes.md"; filename*=UTF-8''${encodeURIComponent(exported.filename)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
