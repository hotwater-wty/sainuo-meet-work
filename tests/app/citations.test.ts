import { describe, expect, it } from "vitest";
import { retrieveCitations } from "../../src/lib/citations.js";
import type { SourceRecord } from "../../src/lib/types.js";

const source: SourceRecord = {
  metadata: {
    id: "SRC1",
    kind: "upload",
    title: "WebSocket Protocol",
    filename: "rfc.txt",
    mediaType: "text/plain",
    characterCount: 120,
    indexedCharacterCount: 120,
    headingCount: 2,
    outline: ["Handshake", "Masking"],
    chunkCount: 2,
    genre: "specification",
    scale: "document",
    quality: {
      textCoverage: 1,
      lowTextPages: [],
      imageCount: 0,
      outlineConfidence: "high",
      missingAssets: [],
      warnings: [],
    },
    createdAt: new Date().toISOString(),
  },
  headings: ["Handshake", "Masking"],
  chunks: [
    { id: "S1", text: "The opening handshake uses Upgrade and Sec-WebSocket-Key.", page: 4, headingPath: ["Handshake"], containsCode: false },
    { id: "S2", text: "Client frames use a masking key.", page: 18, headingPath: ["Masking"], containsCode: false },
  ],
};

describe("citation mapping", () => {
  it("returns only real source IDs with server-generated locations", () => {
    const result = retrieveCitations(source, "opening handshake Upgrade");
    expect(result.evidenceInsufficient).toBe(false);
    expect(result.citations[0].chunkId).toBe("S1");
    expect(result.citations[0].label).toContain("第 4 页");
    expect(result.citations.every((citation) => source.chunks.some((chunk) => chunk.id === citation.chunkId))).toBe(true);
  });

  it("reports insufficient evidence for an empty query", () => {
    expect(retrieveCitations(source, "")).toEqual({ citations: [], evidenceInsufficient: true });
  });
});
