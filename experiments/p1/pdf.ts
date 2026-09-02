import { basename } from "node:path";
import { readFile } from "node:fs/promises";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chunkSections, type TextSection } from "./chunk";
import { classifyGenre, classifyScale } from "./classify";
import type { ParsedSource } from "./types";

interface OutlineItem {
  title: string;
  items?: OutlineItem[];
}

function flattenOutline(items: OutlineItem[] | null, output: string[] = []): string[] {
  for (const item of items ?? []) {
    if (item.title.trim()) output.push(item.title.trim());
    flattenOutline(item.items ?? [], output);
  }
  return output;
}

export async function parsePdf(path: string): Promise<ParsedSource> {
  return parsePdfData(new Uint8Array(await readFile(path)), basename(path, ".pdf"));
}

export async function parsePdfData(data: Uint8Array, title: string): Promise<ParsedSource> {
  const task = getDocument({ data, useSystemFonts: true });
  const pdf = await task.promise;
  const pageCount = pdf.numPages;
  const outline = flattenOutline((await pdf.getOutline()) as OutlineItem[] | null);
  const sections: TextSection[] = [];
  const lowTextPages: number[] = [];
  let imageCount = 0;
  let readablePages = 0;
  let characterCount = 0;

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .trim();
      const operatorList = await page.getOperatorList();
      imageCount += operatorList.fnArray.filter(
        (operator) =>
          operator === OPS.paintImageXObject ||
          operator === OPS.paintInlineImageXObject ||
          operator === OPS.paintImageMaskXObject,
      ).length;

      characterCount += text.length;
      if (text.length >= 100) readablePages += 1;
      else lowTextPages.push(pageNumber);
      if (text) sections.push({ text, page: pageNumber });
      page.cleanup();
    }
  } finally {
    await task.destroy();
  }

  if (!characterCount) throw new Error("PDF contains no extractable text; OCR is not enabled");

  const textCoverage = readablePages / pageCount;
  const warnings: string[] = [];
  if (textCoverage < 0.8) {
    warnings.push(
      `Only ${Math.round(textCoverage * 100)}% of pages contain substantial extractable text; screenshots, scans, or complex layouts may be incomplete`,
    );
  }
  if (!outline.length) warnings.push("PDF has no extractable outline; page-level navigation will be used");

  return {
    title,
    mediaType: "application/pdf",
    characterCount,
    pageCount,
    headings: outline,
    chunks: chunkSections(sections),
    genre: classifyGenre(title, outline),
    scale: classifyScale(pageCount, characterCount),
    quality: {
      textCoverage,
      lowTextPages,
      imageCount,
      outlineConfidence: outline.length >= 5 ? "high" : outline.length ? "medium" : "low",
      missingAssets: [],
      warnings,
    },
  };
}
