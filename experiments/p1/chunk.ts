import type { SourceChunk } from "./types";

export interface TextSection {
  text: string;
  page?: number;
  headingPath?: string[];
  containsCode?: boolean;
}

export function chunkSections(
  sections: TextSection[],
  targetLength = 1_000,
  overlap = 150,
): SourceChunk[] {
  const chunks: SourceChunk[] = [];
  let index = 0;

  for (const section of sections) {
    const normalized = section.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!normalized) continue;

    let start = 0;
    while (start < normalized.length) {
      let end = Math.min(start + targetLength, normalized.length);
      if (end < normalized.length) {
        const boundary = Math.max(
          normalized.lastIndexOf("\n", end),
          normalized.lastIndexOf("。", end),
          normalized.lastIndexOf(". ", end),
        );
        if (boundary > start + targetLength * 0.6) end = boundary + 1;
      }
      chunks.push({
        id: `S${++index}`,
        text: normalized.slice(start, end).trim(),
        page: section.page,
        headingPath: section.headingPath ?? [],
        containsCode: section.containsCode ?? false,
      });
      if (end >= normalized.length) break;
      start = Math.max(start + 1, end - overlap);
    }
  }

  return chunks;
}
