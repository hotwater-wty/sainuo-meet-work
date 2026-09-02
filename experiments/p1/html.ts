import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { chunkSections, type TextSection } from "./chunk";
import { classifyGenre, classifyScale } from "./classify";
import type { ParsedSource } from "./types";

export function parseHtml(html: string, sourceUrl = "https://example.invalid/"): ParsedSource {
  const { document } = parseHTML(html);
  Object.defineProperty(document, "URL", { value: sourceUrl });
  const article = new Readability(document as unknown as Document).parse();
  const contentDom = article?.content ? parseHTML(article.content).document : document;
  const headings = [...contentDom.querySelectorAll("h1,h2,h3,h4,h5,h6,.h1,.h2,.h3")]
    .map((node) => node.textContent.trim())
    .filter(Boolean);
  const headingStack: string[] = [];
  const sections: TextSection[] = [];
  const legacyPres = contentDom.querySelectorAll("pre");
  const hasLegacyHeadings = Boolean(contentDom.querySelector(".h1,.h2,.h3"));
  if (hasLegacyHeadings && legacyPres.length) {
    let buffer = "";
    const flush = () => {
      const text = buffer.trim();
      if (text) sections.push({ text, headingPath: headingStack.filter(Boolean) });
      buffer = "";
    };
    for (const pre of legacyPres) {
      for (const child of pre.childNodes) {
        if (child.nodeType === 1) {
          const element = child as unknown as Element;
          const match = element.getAttribute("class")?.match(/^h([1-3])$/);
          if (match) {
            flush();
            const depth = Number(match[1]);
            headingStack.splice(depth - 1);
            headingStack[depth - 1] = element.textContent?.trim() ?? "";
            continue;
          }
        }
        buffer += child.textContent ?? "";
      }
      flush();
    }
  }
  for (const node of hasLegacyHeadings && legacyPres.length
    ? []
    : contentDom.querySelectorAll("h1,h2,h3,h4,h5,h6,p,pre,li")) {
    if (/^H[1-6]$/.test(node.tagName)) {
      const depth = Number(node.tagName.slice(1));
      headingStack.splice(depth - 1);
      headingStack[depth - 1] = node.textContent.trim();
      continue;
    }
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (text) {
      sections.push({
        text,
        headingPath: headingStack.filter(Boolean),
        containsCode: node.tagName === "PRE",
      });
    }
  }

  if (!sections.length) {
    const fallbackText =
      article?.textContent?.trim() || contentDom.documentElement?.textContent?.trim() || "";
    if (!fallbackText) throw new Error("HTML contains no readable main content");
    sections.push({ text: fallbackText });
  }
  const title = article?.title || headings[0] || new URL(sourceUrl).hostname;
  const characterCount = sections.reduce((sum, section) => sum + section.text.length, 0);
  return {
    title,
    mediaType: "text/html",
    characterCount,
    headings,
    chunks: chunkSections(sections),
    genre: classifyGenre(title, headings),
    scale: classifyScale(undefined, characterCount),
    quality: {
      textCoverage: 1,
      lowTextPages: [],
      imageCount: contentDom.querySelectorAll("img").length,
      outlineConfidence: headings.length >= 5 ? "high" : headings.length ? "medium" : "low",
      missingAssets: [],
      warnings: [],
    },
  };
}
