import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";
import { Agent, request } from "undici";

const ALLOWED_TYPES = [
  "text/html",
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/xhtml+xml",
];

export interface FetchedSource {
  body: Uint8Array;
  contentType: string;
  finalUrl: string;
  redirects: number;
}

const forbiddenIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  forbiddenIpv4.addSubnet(network, prefix, "ipv4");
}
const forbiddenIpv6 = new BlockList();
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["::ffff:0:0", 96],
  ["64:ff9b::", 96],
  ["100::", 64],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  forbiddenIpv6.addSubnet(network, prefix, "ipv6");
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
}

export function isForbiddenIp(address: string): boolean {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);
  if (family === 4) return forbiddenIpv4.check(normalized, "ipv4");
  if (family === 6) return forbiddenIpv6.check(normalized, "ipv6");
  return true;
}

export function validateUrlSyntax(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS URLs are allowed");
  }
  if (url.username || url.password) throw new Error("URLs containing credentials are not allowed");
  if (!url.hostname) throw new Error("URL hostname is required");
  const hostname = normalizeHostname(url.hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Localhost URLs are not allowed");
  }
  if (isIP(hostname) && isForbiddenIp(hostname)) {
    throw new Error("Private, local, or reserved network targets are not allowed");
  }
  return url;
}

async function resolvePublic(hostname: string): Promise<LookupAddress[]> {
  const addresses = await dnsLookup(normalizeHostname(hostname), { all: true, verbatim: true });
  if (!addresses.length) throw new Error("URL hostname did not resolve");
  if (addresses.some(({ address }) => isForbiddenIp(address))) {
    throw new Error("URL resolves to a private, local, or reserved network target");
  }
  return addresses;
}

function createValidatedDispatcher(): Agent {
  return new Agent({
    connect: {
      lookup(hostname, options, callback) {
        resolvePublic(hostname)
          .then((addresses) => {
            const wantsAll = typeof options === "object" && options !== null && "all" in options && options.all;
            if (wantsAll) callback(null, addresses as never);
            else callback(null, addresses[0].address, addresses[0].family);
          })
          .catch((error: Error) => callback(error, undefined as never, undefined as never));
      },
    },
  });
}

export async function fetchPublicSource(
  input: string,
  options: { maxBytes?: number; maxRedirects?: number; timeoutMs?: number } = {},
): Promise<FetchedSource> {
  const maxBytes = options.maxBytes ?? 10 * 1024 * 1024;
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 15_000;
  let current = validateUrlSyntax(input);
  let redirects = 0;

  while (true) {
    await resolvePublic(current.hostname);
    const dispatcher = createValidatedDispatcher();
    try {
      const response = await request(current, {
        method: "GET",
        dispatcher,
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          accept: "text/html,application/xhtml+xml,application/pdf,text/plain,text/markdown;q=0.9",
          "user-agent": "TechnicalDocDeepReader-P1/0.2",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.body.destroy();
        if (redirects >= maxRedirects) throw new Error("URL exceeded redirect limit");
        const location = response.headers.location;
        if (!location || Array.isArray(location)) throw new Error("Redirect response has no valid location");
        current = validateUrlSyntax(new URL(location, current).toString());
        redirects += 1;
        continue;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.body.destroy();
        throw new Error(`URL returned HTTP ${response.statusCode}`);
      }

      const contentType = String(response.headers["content-type"] ?? "")
        .split(";")[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_TYPES.includes(contentType)) {
        response.body.destroy();
        throw new Error(`Unsupported URL content type: ${contentType || "missing"}`);
      }
      const declaredLength = Number(response.headers["content-length"] ?? 0);
      if (declaredLength > maxBytes) {
        response.body.destroy();
        throw new Error("URL response exceeds size limit");
      }

      const chunks: Buffer[] = [];
      let total = 0;
      for await (const chunk of response.body) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
          response.body.destroy();
          throw new Error("URL response exceeds size limit");
        }
        chunks.push(buffer);
      }
      return {
        body: Buffer.concat(chunks),
        contentType,
        finalUrl: current.toString(),
        redirects,
      };
    } finally {
      await dispatcher.close();
    }
  }
}
