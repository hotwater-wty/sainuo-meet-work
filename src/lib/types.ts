import type { ParsedSource, ParseQuality, SourceChunk } from "../../experiments/p1/types";

export type ReadingGoal = "overview" | "mechanism" | "implementation";
export type Familiarity = "new" | "basic" | "experienced";
export type StageStatus = "pending" | "active" | "awaiting_note" | "completed";

export interface ReaderProfile {
  goal: ReadingGoal;
  familiarity: Familiarity;
  focus?: string;
  selectedScope?: string;
}

export interface SourceMetadata {
  id: string;
  kind: "upload" | "url";
  title: string;
  filename?: string;
  url?: string;
  fetchedAt?: string;
  mediaType: string;
  pageCount?: number;
  characterCount: number;
  indexedCharacterCount: number;
  headingCount: number;
  outline: string[];
  chunkCount: number;
  genre: ParsedSource["genre"];
  scale: ParsedSource["scale"];
  quality: ParseQuality;
  createdAt: string;
}

export interface SourceRecord {
  metadata: SourceMetadata;
  chunks: SourceChunk[];
  headings: string[];
}

export interface Citation {
  chunkId: string;
  label: string;
  excerpt: string;
  page?: number;
  headingPath: string[];
}

export interface ReadingMessage {
  id: string;
  role: "assistant" | "user";
  kind: "explanation" | "follow_up" | "rephrase" | "check_answer";
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface ReadingStage {
  id: string;
  title: string;
  objective: string;
  sourceScopes: string[];
  rationale: string;
  status: StageStatus;
  checkQuestion?: string;
  messages: ReadingMessage[];
}

export interface DocumentMap {
  purpose: string;
  scope: string;
  coreProblem: string;
  keyConclusions: string[];
  prerequisites: string[];
  terms: Array<{ term: string; meaning: string }>;
  limitations: string[];
}

export interface ReadingPlan {
  id: string;
  createdAt: string;
  map: DocumentMap;
  stages: ReadingStage[];
}

export interface NoteDraft {
  id: string;
  stageId: string;
  content: string;
  status: "pending" | "accepted" | "skipped";
  createdAt: string;
  resolvedAt?: string;
}

export interface SessionState {
  id: string;
  createdAt: string;
  lastAccessedAt: string;
  expiresAt: string;
  source?: SourceRecord;
  profile?: ReaderProfile;
  plan?: ReadingPlan;
  notes: NoteDraft[];
  requestLog: number[];
  streamingStageId?: string;
}

export interface SessionView {
  id: string;
  expiresAt: string;
  source?: SourceMetadata;
  profile?: ReaderProfile;
  plan?: ReadingPlan;
  notes: NoteDraft[];
}
