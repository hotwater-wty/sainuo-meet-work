import { describe, expect, it } from "vitest";
import { chunkSections } from "../../experiments/p1/chunk.js";

describe("chunkSections", () => {
  it("preserves source metadata and applies overlap", () => {
    const text = `${"a".repeat(650)}。${"b".repeat(650)}`;
    const chunks = chunkSections(
      [{ text, page: 7, headingPath: ["Rules"], containsCode: true }],
      800,
      100,
    );
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.page === 7)).toBe(true);
    expect(chunks.every((chunk) => chunk.headingPath[0] === "Rules")).toBe(true);
    expect(chunks.every((chunk) => chunk.containsCode)).toBe(true);
    expect(chunks[0].text.slice(-100)).toBe(chunks[1].text.slice(0, 100));
  });
});
