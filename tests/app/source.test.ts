import { describe, expect, it } from "vitest";
import { MAX_INDEXED_CHARACTERS, parseFetched, parseUploadedFile } from "../../src/lib/source.js";

describe("source import", () => {
  it.each([
    ["notes.txt", "text/plain", "WebSocket uses an opening handshake.", "text/plain"],
    ["guide.md", "text/markdown", "# Guide\n\n```ts\nconst ok = true\n```", "text/markdown"],
    [
      "spec.html",
      "text/html",
      "<!doctype html><html><head><title>Spec</title></head><body><main><h1>Handshake</h1><p>Upgrade the connection.</p></main></body></html>",
      "text/html",
    ],
  ])("parses %s into a unified source", async (name, type, body, expectedType) => {
    const source = await parseUploadedFile(new File([body], name, { type }));
    expect(source.metadata.mediaType).toBe(expectedType);
    expect(source.metadata.chunkCount).toBeGreaterThan(0);
    expect(source.chunks[0]?.id).toBe("S1");
  });

  it("reports unavailable Markdown sidecar assets", async () => {
    const source = await parseUploadedFile(
      new File(["# Guide\n\n![diagram](images/flow.png)"], "guide.md", { type: "text/markdown" }),
    );
    expect(source.metadata.quality.missingAssets).toEqual(["images/flow.png"]);
  });

  it("keeps classification but caps the indexed text", async () => {
    const body = `# Large Guide\n\n${"技术文档内容。".repeat(90_000)}`;
    const source = await parseUploadedFile(new File([body], "large.md", { type: "text/markdown" }));
    expect(source.metadata.characterCount).toBeGreaterThan(MAX_INDEXED_CHARACTERS);
    expect(source.metadata.indexedCharacterCount).toBe(MAX_INDEXED_CHARACTERS);
    expect(source.metadata.quality.warnings.some((warning) => warning.includes("首版索引"))).toBe(true);
  });

  it("rejects unsupported and disguised files", async () => {
    await expect(
      parseUploadedFile(new File(["hello"], "script.js", { type: "text/javascript" })),
    ).rejects.toThrow("仅支持");
    await expect(
      parseUploadedFile(new File(["not a pdf"], "fake.pdf", { type: "application/pdf" })),
    ).rejects.toThrow("有效的 PDF");
  });

  it("parses a fetched public HTML response", async () => {
    const source = await parseFetched({
      body: new TextEncoder().encode("<html><head><title>RFC</title></head><body><main><h1>Protocol</h1><p>Frames carry messages.</p></main></body></html>"),
      contentType: "text/html",
      finalUrl: "https://example.com/rfc.html",
      redirects: 0,
    });
    expect(source.metadata.kind).toBe("url");
    expect(source.metadata.url).toBe("https://example.com/rfc.html");
  });
});
