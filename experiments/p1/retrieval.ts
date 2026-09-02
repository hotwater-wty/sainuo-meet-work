import MiniSearch from "minisearch";
import type { RetrievalCase, RetrievalResult, SourceChunk } from "./types";

function tokens(value: string): string[] {
  const normalized = value.toLowerCase();
  const latin = normalized.match(/[a-z][a-z0-9_.:/-]*|\d+(?:\.\d+)*/g) ?? [];
  const chineseRuns = normalized.match(/[\u3400-\u9fff]+/g) ?? [];
  const chinese = chineseRuns.flatMap((run) => {
    if (run.length === 1) return [run];
    return Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2));
  });
  return [...new Set([...latin, ...chinese])];
}

interface SearchDocument {
  id: string;
  text: string;
  heading: string;
  code: string;
  chunk: SourceChunk;
}

export interface ScoredSourceChunk {
  chunk: SourceChunk;
  score: number;
}

export class LocalRetriever {
  private readonly documents = new Map<string, SearchDocument>();
  private readonly index = new MiniSearch<SearchDocument>({
    fields: ["heading", "code", "text"],
    storeFields: ["id"],
    tokenize: tokens,
    searchOptions: {
      boost: { heading: 2.5, code: 1.8, text: 1 },
      prefix: true,
      fuzzy: 0.15,
    },
  });

  constructor(chunks: SourceChunk[]) {
    const documents = chunks.map((chunk) => ({
      id: chunk.id,
      text: chunk.text,
      heading: chunk.headingPath.join(" "),
      code: chunk.containsCode ? chunk.text : "",
      chunk,
    }));
    for (const document of documents) this.documents.set(document.id, document);
    this.index.addAll(documents);
  }

  search(query: string, limit = 5): SourceChunk[] {
    return this.searchScored(query, limit).map((result) => result.chunk);
  }

  searchScored(query: string, limit = 5): ScoredSourceChunk[] {
    return this.index
      .search(query)
      .slice(0, limit)
      .map((result) => {
        const chunk = this.documents.get(String(result.id))?.chunk;
        return chunk ? { chunk, score: result.score } : undefined;
      })
      .filter((result): result is ScoredSourceChunk => Boolean(result));
  }
}

export function evaluateRetrieval(
  retriever: LocalRetriever,
  cases: RetrievalCase[],
  limit = 5,
): RetrievalResult[] {
  return cases.map((testCase) => {
    const chunks = retriever.search(testCase.query, limit);
    const resultText = chunks.map((chunk) => chunk.text.toLowerCase()).join("\n");
    const matchedTerms = testCase.expectedTerms.filter((term) =>
      resultText.includes(term.toLowerCase()),
    );
    return {
      caseId: testCase.id,
      passed: matchedTerms.length === testCase.expectedTerms.length,
      matchedTerms,
      chunkIds: chunks.map((chunk) => chunk.id),
    };
  });
}
