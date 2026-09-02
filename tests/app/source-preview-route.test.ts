import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createSession } from "../../src/app/api/sessions/route.js";
import { POST as uploadSource } from "../../src/app/api/sources/upload/route.js";
import { GET as sourcePreview } from "../../src/app/api/sources/preview/route.js";

describe("source preview route", () => {
  it("returns parsed source excerpts only for the current temporary session", async () => {
    const created = await createSession(new NextRequest("http://localhost/api/sessions", { method: "POST" }));
    const cookie = created.headers.get("set-cookie")?.split(";")[0] ?? "";
    const form = new FormData();
    form.set("file", new File(["# Title\n\nFirst paragraph.\n\n## Detail\nSecond paragraph."], "notes.md", { type: "text/markdown" }));
    const uploaded = await uploadSource(new NextRequest("http://localhost/api/sources/upload", { method: "POST", headers: { cookie }, body: form }));
    expect(uploaded.status).toBe(201);

    const response = await sourcePreview(new NextRequest("http://localhost/api/sources/preview", { headers: { cookie } }));
    const body = (await response.json()) as { preview: { title: string; chunks: Array<{ id: string; text: string }> } };
    expect(response.status).toBe(200);
    expect(body.preview.title).toBe("Title");
    expect(body.preview.chunks[0]?.id).toBe("S1");
    expect(body.preview.chunks[0]?.text).toContain("First paragraph");
  });
});
