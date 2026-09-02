import { chmod, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";

const sourcePath = process.argv[2];

if (!sourcePath) {
  throw new Error("Usage: npm run config:import -- /absolute/path/to/config.csv");
}

const rows = parse(await readFile(resolve(sourcePath), "utf8"), {
  bom: true,
  relaxColumnCount: true,
  skipEmptyLines: true,
  trim: true,
}) as string[][];

const values = new Map(rows.filter((row) => row.length >= 2).map(([key, value]) => [key, value]));
const apiKey = values.get("apiKey");
const baseUrl = values.get("openAiCompatible");

if (!apiKey || !baseUrl) {
  throw new Error("CSV must contain apiKey and openAiCompatible rows");
}

const quote = (value: string) => JSON.stringify(value);
const env = [
  "# Generated from a local credential export. Never commit this file.",
  `LLM_BASE_URL=${quote(baseUrl.replace(/\/+$/, ""))}`,
  `LLM_API_KEY=${quote(apiKey)}`,
  'LLM_MODEL="qwen3.6-flash"',
  'LLM_TIMEOUT_MS="60000"',
  'P1_VAULT_PATH="/Users/Admin/Documents/Obsidian Vault"',
  "",
].join("\n");

const target = resolve(".env.local");
await writeFile(target, env, { encoding: "utf8", mode: 0o600 });
await chmod(target, 0o600);
console.log(`Wrote ${target} with required keys; values were not printed.`);
