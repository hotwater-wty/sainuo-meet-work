import { describe, expect, it } from "vitest";
import { preferredStageId } from "../../src/lib/stage-selection.js";
import type { StageStatus } from "../../src/lib/types.js";

function stages(...statuses: StageStatus[]) {
  return statuses.map((status, index) => ({ id: `ST${index + 1}`, status }));
}

describe("preferred stage selection", () => {
  it("keeps an active or awaiting-note stage selected", () => {
    expect(preferredStageId(stages("completed", "active", "pending"))).toBe("ST2");
    expect(preferredStageId(stages("completed", "awaiting_note", "pending"))).toBe("ST2");
  });

  it("resumes at the first pending stage after completed work", () => {
    expect(preferredStageId(stages("completed", "pending", "pending"))).toBe("ST2");
  });

  it("shows the final stage when the route is fully completed", () => {
    expect(preferredStageId(stages("completed", "completed"))).toBe("ST2");
    expect(preferredStageId(undefined)).toBeUndefined();
  });
});
