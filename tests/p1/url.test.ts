import { describe, expect, it } from "vitest";
import { isForbiddenIp, validateUrlSyntax } from "../../experiments/p1/url.js";

describe("URL safety", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.20.1.1",
    "192.168.1.1",
    "::1",
    "::ffff:7f00:1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
  ])("blocks non-public address %s", (address) => {
    expect(isForbiddenIp(address)).toBe(true);
  });

  it("allows a public address", () => {
    expect(isForbiddenIp("1.1.1.1")).toBe(false);
  });

  it.each([
    "file:///etc/passwd",
    "http://localhost:3000",
    "http://user:pass@example.com",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
  ])(
    "rejects unsafe URL %s",
    (url) => expect(() => validateUrlSyntax(url)).toThrow(),
  );
});
