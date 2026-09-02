import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET as exportRoute } from "../../src/app/api/notes/export/route.js";
import { SESSION_COOKIE } from "../../src/lib/session-http.js";
import { sessionStore } from "../../src/lib/session-store.js";

describe("note export route", () => {
  it("returns a safe Markdown download header", async () => {
    const session = sessionStore.create();
    const now = new Date().toISOString();
    session.profile = { goal: "overview", familiarity: "new" };
    session.source = {
      metadata: {
        id: "SRC",
        kind: "upload",
        title: "RFC 6455",
        filename: "rfc.txt",
        mediaType: "text/plain",
        characterCount: 10,
        indexedCharacterCount: 10,
        headingCount: 0,
        outline: [],
        chunkCount: 1,
        genre: "specification",
        scale: "document",
        quality: { textCoverage: 1, lowTextPages: [], imageCount: 0, outlineConfidence: "low", missingAssets: [], warnings: [] },
        createdAt: now,
      },
      headings: [],
      chunks: [{ id: "S1", text: "handshake", headingPath: [], containsCode: false }],
    };
    session.plan = {
      id: "P1",
      createdAt: now,
      map: {
        purpose: "理解协议",
        scope: "RFC",
        coreProblem: "握手",
        keyConclusions: ["升级连接", "校验密钥"],
        prerequisites: [],
        terms: [
          { term: "Upgrade", meaning: "升级" },
          { term: "Nonce", meaning: "随机数" },
          { term: "Frame", meaning: "帧" },
        ],
        limitations: [],
      },
      stages: [
        { id: "ST1", title: "握手", objective: "理解握手", sourceScopes: ["全文"], rationale: "起点", status: "completed", messages: [] },
      ],
    };
    session.notes.push({ id: "N1", stageId: "ST1", content: "## 握手\n\n已确认。", status: "accepted", createdAt: now });

    const response = await exportRoute(
      new NextRequest("http://localhost/api/notes/export", {
        headers: { cookie: `${SESSION_COOKIE}=${session.id}` },
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/markdown");
    expect(response.headers.get("content-disposition")).toContain('filename="reading-notes.md"');
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''");
    expect(await response.text()).toContain("已确认");
  });
});
