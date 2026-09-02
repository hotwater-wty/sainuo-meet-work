import { describe, expect, it } from "vitest";
import { exportNotes } from "../../src/lib/export-notes.js";
import type { CompleteRequest, ModelClient } from "../../src/lib/model-client.js";
import { createNoteDraft, resolveNoteDraft, skipNoteDraft } from "../../src/lib/note-service.js";
import type { SessionState } from "../../src/lib/types.js";

class NoteModel implements ModelClient {
  calls = 0;

  async complete(_request: CompleteRequest) {
    this.calls += 1;
    return {
      text: JSON.stringify({
        summary: "该文档规定事务中避免远程调用。",
        mechanisms: ["事务执行器包裹本地数据库操作"],
        constraints: ["事务内不执行 HTTP/RPC"],
        examples: ["先提交订单，再异步通知"],
        pitfalls: ["长事务占用连接"],
        openQuestions: ["如何处理消息补偿？"],
      }),
    };
  }
}

function session(): SessionState {
  const now = new Date().toISOString();
  return {
    id: "SESSION1",
    createdAt: now,
    lastAccessedAt: now,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    requestLog: [],
    notes: [],
    profile: { goal: "implementation", familiarity: "experienced", focus: "事务边界" },
    source: {
      metadata: {
        id: "SRC1",
        kind: "upload",
        title: "事务/规范",
        filename: "rules.md",
        mediaType: "text/markdown",
        characterCount: 100,
        indexedCharacterCount: 100,
        headingCount: 1,
        outline: ["事务边界"],
        chunkCount: 1,
        genre: "policy",
        scale: "document",
        quality: {
          textCoverage: 1,
          lowTextPages: [],
          imageCount: 0,
          outlineConfidence: "high",
          missingAssets: [],
          warnings: [],
        },
        createdAt: now,
      },
      headings: ["事务边界"],
      chunks: [{ id: "S1", text: "事务内不执行 HTTP RPC。", page: 2, headingPath: ["事务边界"], containsCode: false }],
    },
    plan: {
      id: "PLAN1",
      createdAt: now,
      map: {
        purpose: "说明事务边界",
        scope: "事务",
        coreProblem: "如何避免长事务",
        keyConclusions: ["避免远程调用", "边界清晰"],
        prerequisites: [],
        terms: [
          { term: "事务", meaning: "原子操作" },
          { term: "RPC", meaning: "远程调用" },
          { term: "幂等", meaning: "重复安全" },
        ],
        limitations: [],
      },
      stages: [
        {
          id: "ST1",
          title: "事务边界",
          objective: "理解远程调用风险",
          sourceScopes: ["事务边界"],
          rationale: "核心约束",
          status: "awaiting_note",
          checkQuestion: "为什么避免远程调用？",
          messages: [
            {
              id: "M1",
              role: "assistant",
              kind: "explanation",
              content: "该文档规定事务内不执行 HTTP/RPC [S1]。",
              citations: [
                { chunkId: "S1", label: "事务/规范 · 第 2 页", excerpt: "事务内不执行 HTTP RPC。", page: 2, headingPath: ["事务边界"] },
              ],
              createdAt: now,
            },
          ],
        },
        {
          id: "ST2",
          title: "消息一致性",
          objective: "理解消息补偿",
          sourceScopes: ["事务边界"],
          rationale: "后续阶段",
          status: "pending",
          messages: [],
        },
      ],
    },
  };
}

describe("confirmed notes", () => {
  it("creates one AI draft per stage and reuses it", async () => {
    const state = session();
    const model = new NoteModel();
    const first = await createNoteDraft(state, "ST1", model);
    const second = await createNoteDraft(state, "ST1", model);
    expect(first.draft.id).toBe(second.draft.id);
    expect(model.calls).toBe(1);
    expect(first.draft.content).toContain("### 规则与约束");
    expect(first.draft.content).toContain("[S1]");
  });

  it("accepts edited content idempotently and rejects a conflicting skip", async () => {
    const state = session();
    const { draft } = await createNoteDraft(state, "ST1", new NoteModel());
    const edited = `${draft.content}\n<script>alert(1)</script>\n[x](javascript:alert(1))`;
    const first = resolveNoteDraft(state, "ST1", {
      draftId: draft.id,
      action: "accept",
      editedContent: edited,
    });
    const second = resolveNoteDraft(state, "ST1", {
      draftId: draft.id,
      action: "accept",
      editedContent: edited,
    });
    expect(first.notes).toHaveLength(1);
    expect(second.notes).toHaveLength(1);
    expect(second.notes[0].content).toContain("&lt;script");
    expect(second.notes[0].content).toContain("blocked-link");
    expect(second.plan?.stages[0].status).toBe("completed");
    expect(() => resolveNoteDraft(state, "ST1", { draftId: draft.id, action: "skip" })).toThrow(
      "已经完成其他处理",
    );
  });

  it("skips a stage without calling the model or creating a draft", () => {
    const state = session();
    const result = skipNoteDraft(state, "ST1");

    expect(result.plan?.stages[0].status).toBe("completed");
    expect(result.notes).toHaveLength(1);
    expect(result.notes[0]).toMatchObject({ stageId: "ST1", status: "skipped", content: "" });
    expect(() => skipNoteDraft(state, "ST1")).not.toThrow();
  });

  it("excludes skipped notes and exports accepted edits with real citations", async () => {
    const state = session();
    const { draft } = await createNoteDraft(state, "ST1", new NoteModel());
    resolveNoteDraft(state, "ST1", {
      draftId: draft.id,
      action: "accept",
      editedContent: `${draft.content}\n\n用户补充：检查连接池占用。`,
    });
    state.notes.push({
      id: "00000000-0000-4000-8000-000000000000",
      stageId: "ST2",
      content: "不应导出",
      status: "skipped",
      createdAt: new Date().toISOString(),
    });
    const exported = exportNotes(state);
    expect(exported.filename).toBe("事务-规范-精读笔记.md");
    expect(exported.content).toContain("用户补充");
    expect(exported.content).toContain("[S1] 事务/规范 · 第 2 页");
    expect(exported.content).not.toContain("不应导出");
  });

  it("rejects export without accepted notes", () => {
    expect(() => exportNotes(session())).toThrow("至少接受一份");
  });
});
