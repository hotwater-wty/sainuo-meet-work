import { describe, expect, it } from "vitest";
import { classifyGenre, classifyScale } from "../../experiments/p1/classify.js";

describe("document classification", () => {
  it("recognizes specifications and policies", () => {
    expect(classifyGenre("RFC 6455", ["Protocol Overview"])).toBe("specification");
    expect(classifyGenre("数据库事务代码规范", [])).toBe("policy");
    expect(classifyGenre("MyBatisPlus数据库事务代码规范", ["标准方案"])).toBe("policy");
  });

  it("uses the agreed book thresholds", () => {
    expect(classifyScale(121, 10_000)).toBe("book");
    expect(classifyScale(20, 200_001)).toBe("book");
    expect(classifyScale(120, 200_000)).toBe("document");
  });
});
