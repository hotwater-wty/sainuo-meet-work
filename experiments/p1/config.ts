import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export async function loadLocalEnv(path = ".env.local"): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(resolve(path), "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].trim();
    try {
      process.env[match[1]] = JSON.parse(value) as string;
    } catch {
      process.env[match[1]] = value;
    }
  }
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
