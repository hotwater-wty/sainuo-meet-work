import { mkdir, writeFile } from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { mybatisCases, rfcCases } from "./benchmarks";
import { loadLocalEnv, requiredEnv } from "./config";
import { parseHtml } from "./html";
import { parseMarkdown } from "./markdown";
import { QwenClient, type ProbeResult, type StructuredProbeResult } from "./model";
import { parsePdf } from "./pdf";
import { evaluateRetrieval, LocalRetriever } from "./retrieval";
import type { ParsedSource, RetrievalResult } from "./types";
import { fetchPublicSource } from "./url";

type RunSection = "parsing" | "retrieval" | "model";

interface SourceSummary {
  name: string;
  mediaType: string;
  pageCount?: number;
  characterCount: number;
  chunkCount: number;
  headingCount: number;
  genre: ParsedSource["genre"];
  scale: ParsedSource["scale"];
  quality: ParsedSource["quality"];
}

interface P1Result {
  generatedAt: string;
  runtime: string;
  modelAlias?: string;
  parsing?: SourceSummary[];
  urlImport?: {
    ok: boolean;
    fetchMode?: "secure-gateway" | "fixed-url-harness";
    finalUrl?: string;
    redirects?: number;
    contentType?: string;
    gatewayError?: string;
    error?: string;
  };
  retrieval?: Record<string, RetrievalResult[]>;
  model?: {
    structured: StructuredProbeResult;
    streaming: ProbeResult;
    vision: ProbeResult;
  };
}

await loadLocalEnv();
const only = process.argv.find((argument) => argument.startsWith("--only="))?.split("=")[1] as
  | RunSection
  | undefined;
const sections = new Set<RunSection>(only ? [only] : ["parsing", "retrieval", "model"]);
const vault = resolve(process.env.P1_VAULT_PATH ?? "/Users/Admin/Documents/Obsidian Vault");
const rfcUrl = "https://www.rfc-editor.org/rfc/rfc6455.html";
const execFile = promisify(execFileCallback);
const parsed = new Map<string, ParsedSource>();
const result: P1Result = {
  generatedAt: new Date().toISOString(),
  runtime: `${process.release.name} ${process.version}`,
};

async function ensureSources(): Promise<void> {
  if (parsed.size) return;
  const localFiles = [
    "MyBatisPlus数据库事务代码规范.pdf",
    "AI-Agents-in-Depth-zh-CN.pdf",
    "TypeScript 极速梳理.pdf",
    "11 Java后端打包部署教程.pdf",
    "Vue3快速上手.md",
  ];
  for (const filename of localFiles) {
    const path = join(vault, filename);
    const source = filename.endsWith(".md") ? await parseMarkdown(path) : await parsePdf(path);
    parsed.set(filename, source);
    process.stdout.write(`Parsed ${filename}: ${source.chunks.length} chunks\n`);
  }

  let html: string;
  let finalUrl = rfcUrl;
  try {
    const fetched = await fetchPublicSource(rfcUrl);
    if (fetched.contentType !== "text/html") {
      throw new Error(`RFC URL returned unexpected type ${fetched.contentType}`);
    }
    html = new TextDecoder().decode(fetched.body);
    finalUrl = fetched.finalUrl;
    result.urlImport = {
      ok: true,
      fetchMode: "secure-gateway",
      finalUrl,
      redirects: fetched.redirects,
      contentType: fetched.contentType,
    };
  } catch (error) {
    // Codex's network layer maps public hosts to 198.18.0.0/15. Keep the
    // production SSRF rule intact and use a hard-coded URL only in this harness.
    const gatewayError = safeError(error);
    const fetched = await execFile(
      "curl",
      [
        "--proto",
        "=http,https",
        "--location",
        "--max-redirs",
        "3",
        "--max-time",
        "20",
        "--max-filesize",
        String(10 * 1024 * 1024),
        "--fail-with-body",
        "--silent",
        "--show-error",
        rfcUrl,
      ],
      { encoding: "utf8", maxBuffer: 11 * 1024 * 1024 },
    );
    html = fetched.stdout;
    result.urlImport = {
      ok: true,
      fetchMode: "fixed-url-harness",
      finalUrl,
      redirects: 0,
      contentType: "text/html",
      gatewayError,
    };
  }
  const rfc = parseHtml(html, finalUrl);
  parsed.set("RFC 6455", rfc);
}

try {
  if (sections.has("parsing") || sections.has("retrieval") || sections.has("model")) {
    await ensureSources();
  }
} catch (error) {
  result.urlImport = { ok: false, error: safeError(error) };
  throw error;
}

if (sections.has("parsing")) {
  result.parsing = [...parsed.entries()].map(([name, source]) => summarize(name, source));
}

if (sections.has("retrieval")) {
  result.retrieval = {
    mybatis: evaluateRetrieval(
      new LocalRetriever(requiredSource("MyBatisPlus数据库事务代码规范.pdf").chunks),
      mybatisCases,
    ),
    rfc6455: evaluateRetrieval(new LocalRetriever(requiredSource("RFC 6455").chunks), rfcCases),
  };
}

if (sections.has("model")) {
  const model = requiredEnv("LLM_MODEL");
  result.modelAlias = model;
  const client = new QwenClient(
    requiredEnv("LLM_BASE_URL"),
    requiredEnv("LLM_API_KEY"),
    model,
    Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
  );
  const mybatis = requiredSource("MyBatisPlus数据库事务代码规范.pdf");
  const modelInput = [
    `Document title: ${mybatis.title}`,
    `Pages: ${mybatis.pageCount}; characters: ${mybatis.characterCount}`,
    `Extracted headings: ${mybatis.headings.slice(0, 30).join(" | ")}`,
    "Representative source excerpts:",
    ...mybatis.chunks.slice(0, 5).map((chunk) => `[page ${chunk.page ?? "?"}] ${chunk.text}`),
  ].join("\n");
  result.model = {
    structured: await client.structuredMap(modelInput),
    streaming: await client.streamProbe(),
    vision: await client.visionProbe(),
  };
}

await mkdir(resolve("tmp"), { recursive: true });
const outputPath = resolve("tmp/p1-results.json");
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote redacted aggregate results to ${basename(outputPath)}\n`);

function requiredSource(name: string): ParsedSource {
  const source = parsed.get(name);
  if (!source) throw new Error(`Required parsed source is unavailable: ${name}`);
  return source;
}

function summarize(name: string, source: ParsedSource): SourceSummary {
  return {
    name,
    mediaType: source.mediaType,
    pageCount: source.pageCount,
    characterCount: source.characterCount,
    chunkCount: source.chunks.length,
    headingCount: source.headings.length,
    genre: source.genre,
    scale: source.scale,
    quality: source.quality,
  };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 500);
}
