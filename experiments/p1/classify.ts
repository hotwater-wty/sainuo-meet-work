import type { DocumentGenre, DocumentScale } from "./types";

export function classifyGenre(title: string, headings: string[]): DocumentGenre {
  const text = `${title}\n${headings.slice(0, 40).join("\n")}`.toLowerCase();
  if (/代码规范|事务规范|开发规范|编码规范|约定|强制要求|代码审查/.test(text)) return "policy";
  if (/\brfc\b|protocol|协议|标准/.test(text)) return "specification";
  if (/规范/.test(text)) return "policy";
  if (/架构|architecture|设计方案/.test(text)) return "architecture";
  return "tutorial";
}

export function classifyScale(pageCount: number | undefined, characterCount: number): DocumentScale {
  return (pageCount ?? 0) > 120 || characterCount > 200_000 ? "book" : "document";
}
