import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseHtml } from "../../experiments/p1/html.js";
import { parseMarkdown } from "../../experiments/p1/markdown.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true })));
});

describe("source parsers", () => {
  it("preserves Markdown headings and reports missing local images", async () => {
    const directory = await mkdtemp(join(tmpdir(), "deep-reader-p1-"));
    temporaryDirectories.push(directory);
    const path = join(directory, "guide.md");
    await writeFile(
      path,
      "# Guide\n\n## Setup\n\n```ts\nconst ready = true;\n```\n\n![diagram](images/missing.png)\n",
    );

    const source = await parseMarkdown(path);
    expect(source.headings).toEqual(["Guide", "Setup"]);
    expect(source.chunks.some((chunk) => chunk.containsCode)).toBe(true);
    expect(source.quality.missingAssets).toEqual(["images/missing.png"]);
  });

  it("extracts static HTML body and heading paths", () => {
    const source = parseHtml(
      "<!doctype html><html><head><title>Protocol Guide</title></head><body><main><h1>Handshake</h1><p>Upgrade the connection using a nonce.</p><h2>Security</h2><p>Validate the origin.</p></main></body></html>",
      "https://example.com/protocol",
    );
    expect(source.characterCount).toBeGreaterThan(20);
    expect(source.headings).toContain("Handshake");
    expect(source.chunks.some((chunk) => chunk.headingPath.includes("Security"))).toBe(true);
  });
});
