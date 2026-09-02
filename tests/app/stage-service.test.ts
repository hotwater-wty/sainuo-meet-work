import { describe, expect, it } from "vitest";
import type { CompleteRequest, ModelClient } from "../../src/lib/model-client.js";
import {
  executePreparedStage,
  finishStage,
  prepareStageAction,
} from "../../src/lib/stage-service.js";
import type { SessionState } from "../../src/lib/types.js";

class StreamModel implements ModelClient {
  constructor(
    private readonly tokens: string[],
    private readonly failAfter = -1,
  ) {}

  async complete(_request: CompleteRequest) {
    return { text: "unused" };
  }

  async *stream(_request: CompleteRequest) {
    for (let index = 0; index < this.tokens.length; index += 1) {
      yield this.tokens[index];
      if (index === this.failAfter) throw new Error("upstream interrupted");
    }
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
    profile: { goal: "mechanism", familiarity: "basic" },
    source: {
      metadata: {
        id: "SRC1",
        kind: "upload",
        title: "事务规范",
        filename: "rules.md",
        mediaType: "text/markdown",
        characterCount: 100,
        indexedCharacterCount: 100,
        headingCount: 2,
        outline: ["事务边界", "一致性"],
        chunkCount: 2,
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
      headings: ["事务边界", "一致性"],
      chunks: [
        { id: "S1", text: "该文档规定事务边界中不得执行 HTTP RPC 远程调用。", page: 2, headingPath: ["事务边界"], containsCode: false },
        { id: "S2", text: "消息一致性使用本地消息表和幂等消费。", page: 8, headingPath: ["一致性"], containsCode: false },
      ],
    },
    plan: {
      id: "PLAN1",
      createdAt: now,
      map: {
        purpose: "说明事务要求",
        scope: "事务",
        coreProblem: "如何控制事务边界",
        keyConclusions: ["边界清晰", "避免远程调用"],
        prerequisites: [],
        terms: [
          { term: "事务", meaning: "原子操作" },
          { term: "幂等", meaning: "重复安全" },
          { term: "消息", meaning: "异步事件" },
        ],
        limitations: [],
      },
      stages: [
        {
          id: "ST1",
          title: "事务边界与远程调用",
          objective: "理解事务中 HTTP RPC 调用的风险",
          sourceScopes: ["事务边界"],
          rationale: "先明确边界",
          status: "pending",
          messages: [],
        },
        {
          id: "ST2",
          title: "消息一致性",
          objective: "理解消息幂等",
          sourceScopes: ["一致性"],
          rationale: "再看异步一致性",
          status: "pending",
          messages: [],
        },
      ],
    },
  };
}

describe("stage streaming state", () => {
  it("commits only after a complete stream and filters unknown citations", async () => {
    const state = session();
    const prepared = prepareStageAction(state, "ST1", { action: "start" });
    const deltas: string[] = [];
    expect(prepared.system).toContain("使用“该文档规定”表述规则");
    expect(prepared.system).toContain("不得补充来源片段之外的文档事实");
    const result = await executePreparedStage(
      prepared,
      new StreamModel(["该文档规定事务内避免远程调用 ", "[S1]，未知引用 [S99] 被忽略。"]),
      (token) => {
        deltas.push(token);
      },
    );
    expect(deltas).toHaveLength(2);
    expect(state.plan?.stages[0].status).toBe("active");
    expect(state.plan?.stages[0].messages).toHaveLength(1);
    expect(result.message.citations.map((citation) => citation.chunkId)).toEqual(["S1"]);
    expect(result.checkQuestion).toContain("关键约束");
    expect(state.streamingStageId).toBeUndefined();
  });

  it("leaves messages and status unchanged after a partial upstream failure", async () => {
    const state = session();
    const prepared = prepareStageAction(state, "ST1", { action: "start" });
    const visible: string[] = [];
    await expect(
      executePreparedStage(prepared, new StreamModel(["partial", "never"], 0), (token) => {
        visible.push(token);
      }),
    ).rejects.toThrow("upstream interrupted");
    expect(visible).toEqual(["partial"]);
    expect(state.plan?.stages[0].status).toBe("pending");
    expect(state.plan?.stages[0].messages).toEqual([]);
    expect(state.streamingStageId).toBeUndefined();
  });

  it("prevents parallel stages and advances only to awaiting_note", async () => {
    const state = session();
    const first = prepareStageAction(state, "ST1", { action: "start" });
    await executePreparedStage(first, new StreamModel(["依据 [S1]"]), () => undefined);
    expect(() => prepareStageAction(state, "ST2", { action: "start" })).toThrow("先完成当前活动阶段");
    const view = finishStage(state, "ST1");
    expect(view.plan?.stages[0].status).toBe("awaiting_note");
    expect(() => prepareStageAction(state, "ST2", { action: "start" })).toThrow("先完成当前活动阶段");
  });

  it("commits a user answer and assistant feedback together", async () => {
    const state = session();
    await executePreparedStage(
      prepareStageAction(state, "ST1", { action: "start" }),
      new StreamModel(["首次讲解 [S1]"]),
      () => undefined,
    );
    const prepared = prepareStageAction(state, "ST1", {
      action: "answer_check",
      message: "远程调用会拉长事务。",
    });
    await executePreparedStage(prepared, new StreamModel(["回答抓住了长事务风险 [S1]"]), () => undefined);
    expect(state.plan?.stages[0].messages.map((message) => message.role)).toEqual([
      "assistant",
      "user",
      "assistant",
    ]);
    expect(state.plan?.stages[0].messages[1].kind).toBe("check_answer");
  });
});
