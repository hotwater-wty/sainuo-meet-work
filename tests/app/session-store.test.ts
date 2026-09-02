import { describe, expect, it } from "vitest";
import { SessionStore, toSessionView } from "../../src/lib/session-store.js";
import type { SourceRecord } from "../../src/lib/types.js";

function source(id = "source-1"): SourceRecord {
  return {
    metadata: {
      id,
      kind: "upload",
      title: "Guide",
      filename: "guide.txt",
      mediaType: "text/plain",
      characterCount: 10,
      indexedCharacterCount: 10,
      headingCount: 0,
      outline: [],
      chunkCount: 1,
      genre: "tutorial",
      scale: "document",
      quality: {
        textCoverage: 1,
        lowTextPages: [],
        imageCount: 0,
        outlineConfidence: "low",
        missingAssets: [],
        warnings: [],
      },
      createdAt: new Date(0).toISOString(),
    },
    headings: [],
    chunks: [{ id: "S1", text: "guide text", headingPath: [], containsCode: false }],
  };
}

describe("SessionStore", () => {
  it("extends a live session and expires inactive state", () => {
    let now = 1_000;
    const store = new SessionStore(100, () => now);
    const session = store.create();
    now = 1_050;
    expect(store.get(session.id)?.expiresAt).toBe(new Date(1_150).toISOString());
    now = 1_151;
    expect(store.get(session.id)).toBeUndefined();
  });

  it("requires confirmation before replacement and clears downstream state", () => {
    const store = new SessionStore();
    const session = store.create();
    store.replaceSource(session, source(), false);
    session.profile = { goal: "overview", familiarity: "new" };
    session.notes.push({
      id: "N1",
      stageId: "ST1",
      content: "note",
      status: "accepted",
      createdAt: new Date().toISOString(),
    });
    expect(() => store.replaceSource(session, source("source-2"), false)).toThrow(
      "当前会话已有文档",
    );
    store.replaceSource(session, source("source-2"), true);
    expect(session.profile).toBeUndefined();
    expect(session.notes).toEqual([]);
    expect(toSessionView(session).source?.id).toBe("source-2");
  });

  it("enforces a bounded request window", () => {
    const store = new SessionStore();
    const session = store.create();
    store.enforceRate(session, 2);
    store.enforceRate(session, 2);
    expect(() => store.enforceRate(session, 2)).toThrow("请求过于频繁");
  });
});
