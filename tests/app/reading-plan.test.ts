import { describe, expect, it } from "vitest";
import { generateReadingPlan } from "../../src/lib/reading-plan.js";
import type { CompleteRequest, ModelClient } from "../../src/lib/model-client.js";
import type { SourceRecord } from "../../src/lib/types.js";

class FakeModel implements ModelClient {
  readonly requests: CompleteRequest[] = [];

  constructor(private readonly outputs: string[]) {}

  async complete(request: CompleteRequest) {
    this.requests.push(request);
    return { text: this.outputs.shift() ?? "{}" };
  }
}

function planJson(scope = "SC01") {
  return JSON.stringify({
    map: {
      purpose: "解释事务约束",
      scope: "数据库事务",
      coreProblem: "如何保持事务边界清晰？",
      keyConclusions: ["该文档规定使用统一事务执行器", "该文档规定避免远程调用"],
      prerequisites: ["Spring 事务基础"],
      terms: [
        { term: "事务边界", meaning: "原子操作范围" },
        { term: "回滚", meaning: "失败后恢复" },
        { term: "幂等", meaning: "重复执行结果一致" },
      ],
      limitations: [],
    },
    stages: [1, 2, 3].map((index) => ({
      title: `阶段 ${index}`,
      objective: `目标 ${index}`,
      sourceScopes: [scope],
      rationale: `理由 ${index}`,
    })),
  });
}

function source(scale: "document" | "book" = "document"): SourceRecord {
  return {
    metadata: {
      id: "SRC1",
      kind: "upload",
      title: "事务规范",
      filename: "rules.md",
      mediaType: "text/markdown",
      characterCount: 100,
      indexedCharacterCount: 100,
      headingCount: 2,
      outline: ["Transactions", "Consistency"],
      chunkCount: 2,
      genre: "policy",
      scale,
      quality: {
        textCoverage: 1,
        lowTextPages: [],
        imageCount: 0,
        outlineConfidence: "high",
        missingAssets: [],
        warnings: ["table layout simplified"],
      },
      createdAt: new Date().toISOString(),
    },
    headings: ["Transactions", "Consistency"],
    chunks: [
      { id: "S1", text: "事务边界应保持清晰。", headingPath: ["Transactions"], containsCode: false },
      { id: "S2", text: "远程调用不应放在事务内。", headingPath: ["Consistency"], containsCode: false },
    ],
  };
}

describe("reading plan generation", () => {
  it("locks stages to allowed scopes and injects parser limitations", async () => {
    const model = new FakeModel([planJson()]);
    const plan = await generateReadingPlan(
      source(),
      { goal: "implementation", familiarity: "experienced", focus: "消息一致性" },
      model,
    );
    expect(plan.stages).toHaveLength(3);
    expect(plan.stages[0].id).toBe("ST1");
    expect(plan.map.limitations[0]).toContain("解析限制");
    expect(model.requests[0].user).toContain("implementation");
    expect(model.requests[0].system).toContain("该文档规定");
  });

  it("repairs one invalid scope and rejects a second invalid response", async () => {
    const repaired = new FakeModel([planJson("Invented"), planJson("SC01")]);
    await expect(
      generateReadingPlan(source(), { goal: "overview", familiarity: "new" }, repaired),
    ).resolves.toBeTruthy();
    expect(repaired.requests).toHaveLength(2);

    const invalid = new FakeModel([planJson("Invented"), planJson("Still invented")]);
    await expect(
      generateReadingPlan(source(), { goal: "overview", familiarity: "new" }, invalid),
    ).rejects.toThrow("无法校验");
  });

  it("normalizes a model-preferred term dictionary", async () => {
    const value = JSON.parse(planJson()) as { map: { terms: unknown } };
    value.map.terms = { 事务边界: "原子操作范围", 回滚: "失败后恢复", 幂等: "重复执行结果一致" };
    const plan = await generateReadingPlan(
      source(),
      { goal: "mechanism", familiarity: "basic" },
      new FakeModel([JSON.stringify(value)]),
    );
    expect(plan.map.terms).toHaveLength(3);
    expect(plan.map.terms[0]).toEqual({ term: "事务边界", meaning: "原子操作范围" });
  });

  it("requires a server-known scope for books", async () => {
    const model = new FakeModel([planJson()]);
    await expect(
      generateReadingPlan(source("book"), { goal: "overview", familiarity: "new" }, model),
    ).rejects.toThrow("先选择章节");
    await expect(
      generateReadingPlan(
        source("book"),
        { goal: "overview", familiarity: "new", selectedScope: "Unknown" },
        model,
      ),
    ).rejects.toThrow("不属于当前文档");
  });
});
