import { describe, expect, it } from "vitest";
import { documentMapSchema } from "../../experiments/p1/model.js";

describe("document map schema", () => {
  it("accepts the required bounded structure", () => {
    expect(
      documentMapSchema.parse({
        title: "RFC 6455",
        genre: "specification",
        scale: "document",
        summary: "WebSocket protocol",
        sections: [{ title: "Handshake", importance: "high" }],
      }),
    ).toBeTruthy();
  });

  it("rejects unsupported enum values", () => {
    expect(() =>
      documentMapSchema.parse({
        title: "x",
        genre: "paper",
        scale: "document",
        summary: "x",
        sections: [{ title: "x", importance: "high" }],
      }),
    ).toThrow();
  });
});
