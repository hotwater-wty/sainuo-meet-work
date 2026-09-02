import { access, readFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { chunkSections, type TextSection } from "./chunk";
import { classifyGenre, classifyScale } from "./classify";
import type { ParsedSource } from "./types";

interface MdNode {
  type: string;
  value?: string;
  depth?: number;
  url?: string;
  children?: MdNode[];
}

function nodeText(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(nodeText).join("");
}

export async function parseMarkdown(path: string): Promise<ParsedSource> {
  const raw = await readFile(path, "utf8");
  return parseMarkdownContent(raw, basename(path), dirname(path));
}

export async function parseMarkdownContent(
  raw: string,
  fallbackTitle: string,
  assetDirectory?: string,
): Promise<ParsedSource> {
  if (!raw.trim()) throw new Error("Markdown file contains no readable content");

  const root = unified().use(remarkParse).parse(raw) as MdNode;
  const headings: string[] = [];
  const headingStack: string[] = [];
  const sections: TextSection[] = [];
  const imageRefs: string[] = [];
  for (const match of raw.matchAll(/<img\b[^>]*?(?:^|\s)src\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    imageRefs.push(match[1]);
  }

  for (const node of root.children ?? []) {
    if (node.type === "heading") {
      const heading = nodeText(node).trim();
      const depth = node.depth ?? 1;
      headingStack.splice(depth - 1);
      headingStack[depth - 1] = heading;
      headings.push(heading);
      continue;
    }
    if (node.type === "image" && node.url) imageRefs.push(node.url);
    const text = nodeText(node).trim();
    if (text) {
      sections.push({
        text,
        headingPath: headingStack.filter(Boolean),
        containsCode: node.type === "code" || node.type === "inlineCode",
      });
    }
    collectImages(node, imageRefs);
  }

  const uniqueImageRefs = [...new Set(imageRefs)];
  const relativeImages = uniqueImageRefs.filter(
    (url) => !/^(?:https?:|data:|#|\/)/i.test(url),
  );
  const missingAssets: string[] = [];
  for (const image of relativeImages) {
    if (!assetDirectory) {
      missingAssets.push(image);
      continue;
    }
    try {
      await access(resolve(assetDirectory, decodeURIComponent(image.split("#")[0])));
    } catch {
      missingAssets.push(image);
    }
  }

  const title = headings[0] || fallbackTitle;
  const chunks = chunkSections(sections);
  const warnings = missingAssets.length
    ? [`${missingAssets.length} referenced local image asset(s) are missing`]
    : [];
  return {
    title,
    mediaType: "text/markdown",
    characterCount: sections.reduce((sum, section) => sum + section.text.length, 0),
    headings,
    chunks,
    genre: classifyGenre(title, headings),
    scale: classifyScale(undefined, raw.length),
    quality: {
      textCoverage: 1,
      lowTextPages: [],
      imageCount: uniqueImageRefs.length,
      outlineConfidence: headings.length >= 3 ? "high" : headings.length ? "medium" : "low",
      missingAssets,
      warnings,
    },
  };
}

function collectImages(node: MdNode, output: string[]): void {
  for (const child of node.children ?? []) {
    if (child.type === "image" && child.url) output.push(child.url);
    collectImages(child, output);
  }
}
