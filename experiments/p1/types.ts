export type DocumentGenre = "specification" | "policy" | "tutorial" | "architecture";
export type DocumentScale = "document" | "book";

export interface ParseQuality {
  textCoverage: number;
  lowTextPages: number[];
  imageCount: number;
  outlineConfidence: "high" | "medium" | "low";
  missingAssets: string[];
  warnings: string[];
}

export interface SourceChunk {
  id: string;
  text: string;
  page?: number;
  headingPath: string[];
  containsCode: boolean;
}

export interface ParsedSource {
  title: string;
  mediaType: string;
  characterCount: number;
  pageCount?: number;
  headings: string[];
  chunks: SourceChunk[];
  genre: DocumentGenre;
  scale: DocumentScale;
  quality: ParseQuality;
}

export interface RetrievalCase {
  id: string;
  query: string;
  expectedTerms: string[];
}

export interface RetrievalResult {
  caseId: string;
  passed: boolean;
  matchedTerms: string[];
  chunkIds: string[];
}
