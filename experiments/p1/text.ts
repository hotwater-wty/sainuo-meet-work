import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { chunkSections } from "./chunk";
import { classifyGenre, classifyScale } from "./classify";
import type { ParsedSource } from "./types";

export async function parseTextFile(path: string): Promise<ParsedSource> {
  return parseTextContent(await readFile(path, "utf8"), basename(path));
}

export function parseTextContent(raw: string, title: string): ParsedSource {
  const text = raw.trim();
  if (!text) throw new Error("Text file contains no readable content");

  const chunks = chunkSections([{ text }]);
  return {
    title,
    mediaType: "text/plain",
    characterCount: text.length,
    headings: [],
    chunks,
    genre: classifyGenre(title, []),
    scale: classifyScale(undefined, text.length),
    quality: {
      textCoverage: 1,
      lowTextPages: [],
      imageCount: 0,
      outlineConfidence: "low",
      missingAssets: [],
      warnings: [],
    },
  };
}
