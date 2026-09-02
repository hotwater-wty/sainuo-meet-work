import { LocalRetriever } from "../../experiments/p1/retrieval";
import type { Citation, SourceRecord } from "./types";

export interface CitationResult {
  citations: Citation[];
  evidenceInsufficient: boolean;
}

export function retrieveCitations(source: SourceRecord, query: string, limit = 5): CitationResult {
  const normalized = query.trim();
  if (!normalized) return { citations: [], evidenceInsufficient: true };
  const results = new LocalRetriever(source.chunks).searchScored(normalized, limit);
  const citations = results
    .filter((result) => result.score >= 0.2)
    .map(({ chunk }) => ({
      chunkId: chunk.id,
      label: chunk.page
        ? `${source.metadata.title} · 第 ${chunk.page} 页`
        : chunk.headingPath.length
          ? `${source.metadata.title} · ${chunk.headingPath.join(" > ")}`
          : `${source.metadata.title} · ${chunk.id}`,
      excerpt: chunk.text.slice(0, 420),
      page: chunk.page,
      headingPath: chunk.headingPath,
    }));
  return { citations, evidenceInsufficient: citations.length === 0 };
}
