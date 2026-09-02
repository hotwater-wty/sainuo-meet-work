import { randomUUID } from "node:crypto";
import { basename, extname } from "node:path";
import { parseHtml } from "../../experiments/p1/html";
import { parseMarkdownContent } from "../../experiments/p1/markdown";
import { parsePdfData } from "../../experiments/p1/pdf";
import { parseTextContent } from "../../experiments/p1/text";
import type { FetchedSource } from "../../experiments/p1/url";
import type { ParsedSource, SourceChunk } from "../../experiments/p1/types";
import { AppError } from "./errors";
import type { SourceMetadata, SourceRecord } from "./types";

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export const MAX_INDEXED_CHARACTERS = 500_000;

const mediaByExtension: Record<string, string[]> = {
  ".pdf": ["application/pdf", "application/octet-stream"],
  ".md": ["text/markdown", "text/plain", "application/octet-stream", ""],
  ".markdown": ["text/markdown", "text/plain", "application/octet-stream", ""],
  ".txt": ["text/plain", "application/octet-stream", ""],
  ".html": ["text/html", "application/xhtml+xml", "text/plain", "application/octet-stream", ""],
  ".htm": ["text/html", "application/xhtml+xml", "text/plain", "application/octet-stream", ""],
};

function safeFilename(value: string): string {
  const name = basename(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return name.slice(0, 180) || "document";
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new AppError("INVALID_ENCODING", "文本文件必须使用 UTF-8 编码");
  }
}

function validateUpload(filename: string, mediaType: string, bytes: Uint8Array): string {
  if (!bytes.byteLength) throw new AppError("EMPTY_FILE", "文件内容为空");
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new AppError("FILE_TOO_LARGE", "文件不能超过 10 MB", 413);
  const extension = extname(filename).toLowerCase();
  const allowedTypes = mediaByExtension[extension];
  if (!allowedTypes) throw new AppError("UNSUPPORTED_FILE", "仅支持 PDF、Markdown、TXT 和 HTML 文件");
  if (!allowedTypes.includes(mediaType.toLowerCase())) {
    throw new AppError("MIME_MISMATCH", "文件类型与扩展名不匹配");
  }
  if (extension === ".pdf" && new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new AppError("INVALID_PDF", "文件不是有效的 PDF");
  }
  return extension;
}

async function parseBytes(
  bytes: Uint8Array,
  filename: string,
  mediaType: string,
  sourceUrl?: string,
): Promise<ParsedSource> {
  const extension = extname(filename).toLowerCase();
  if (mediaType === "application/pdf" || extension === ".pdf") {
    return parsePdfData(bytes, filename.replace(/\.pdf$/i, ""));
  }
  const text = decodeUtf8(bytes);
  if (mediaType === "text/html" || mediaType === "application/xhtml+xml" || /\.html?$/i.test(filename)) {
    return parseHtml(text, sourceUrl ?? "https://upload.invalid/");
  }
  if (mediaType === "text/markdown" || /\.(?:md|markdown)$/i.test(filename)) {
    return parseMarkdownContent(text, filename);
  }
  return parseTextContent(text, filename);
}

function capChunks(chunks: SourceChunk[]): { chunks: SourceChunk[]; characters: number; truncated: boolean } {
  const kept: SourceChunk[] = [];
  let characters = 0;
  for (const chunk of chunks) {
    if (characters >= MAX_INDEXED_CHARACTERS) break;
    const available = MAX_INDEXED_CHARACTERS - characters;
    const text = chunk.text.slice(0, available);
    if (!text) break;
    kept.push({ ...chunk, text });
    characters += text.length;
  }
  return { chunks: kept, characters, truncated: chunks.length > kept.length || characters >= MAX_INDEXED_CHARACTERS };
}

function sourceRecord(
  parsed: ParsedSource,
  input: Pick<SourceMetadata, "kind" | "filename" | "url" | "fetchedAt">,
): SourceRecord {
  const capped = capChunks(parsed.chunks);
  const quality = {
    ...parsed.quality,
    warnings: [...parsed.quality.warnings],
  };
  if (capped.truncated && parsed.characterCount > MAX_INDEXED_CHARACTERS) {
    quality.warnings.push(
      `文档共 ${parsed.characterCount.toLocaleString("zh-CN")} 字符，首版索引仅保留前 ${MAX_INDEXED_CHARACTERS.toLocaleString("zh-CN")} 字符`,
    );
  }
  const metadata: SourceMetadata = {
    id: randomUUID(),
    kind: input.kind,
    title: parsed.title,
    filename: input.filename,
    url: input.url,
    fetchedAt: input.fetchedAt,
    mediaType: parsed.mediaType,
    pageCount: parsed.pageCount,
    characterCount: parsed.characterCount,
    indexedCharacterCount: capped.characters,
    headingCount: parsed.headings.length,
    outline: [...new Set(parsed.headings)].slice(0, 80),
    chunkCount: capped.chunks.length,
    genre: parsed.genre,
    scale: parsed.scale,
    quality,
    createdAt: new Date().toISOString(),
  };
  return { metadata, chunks: capped.chunks, headings: parsed.headings };
}

export async function parseUploadedFile(file: File): Promise<SourceRecord> {
  const filename = safeFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = validateUpload(filename, file.type, bytes);
  try {
    const parsed = await parseBytes(bytes, filename, file.type || mediaByExtension[extension][0]);
    return sourceRecord(parsed, { kind: "upload", filename });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "unknown parsing error";
    if (/no extractable text|no readable content/i.test(message)) {
      throw new AppError("NO_EXTRACTABLE_TEXT", "文档没有可提取文本，首版暂不支持 OCR");
    }
    throw new AppError("PARSE_FAILED", "文档解析失败，请确认文件未损坏", 422);
  }
}

export async function parseFetched(fetched: FetchedSource): Promise<SourceRecord> {
  const url = new URL(fetched.finalUrl);
  const remoteName = safeFilename(decodeURIComponent(url.pathname.split("/").pop() || url.hostname));
  const extension =
    fetched.contentType === "application/pdf"
      ? ".pdf"
      : fetched.contentType.includes("html")
        ? ".html"
        : fetched.contentType.includes("markdown")
          ? ".md"
          : ".txt";
  const filename = extname(remoteName) ? remoteName : `${remoteName}${extension}`;
  try {
    const parsed = await parseBytes(fetched.body, filename, fetched.contentType, fetched.finalUrl);
    return sourceRecord(parsed, {
      kind: "url",
      url: fetched.finalUrl,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("REMOTE_PARSE_FAILED", "网页正文无法解析，请改用文件上传", 422);
  }
}
