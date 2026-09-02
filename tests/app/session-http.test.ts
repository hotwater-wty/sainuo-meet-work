import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { assertSameOrigin } from "../../src/lib/session-http.js";

describe("same-origin request validation", () => {
  it("accepts the request Host even when NextRequest normalizes its URL origin", () => {
    const request = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://127.0.0.1:3000",
      },
    });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });

  it("rejects a different origin host", () => {
    const request = new NextRequest("http://localhost:3000/api/sessions", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3000",
        origin: "http://attacker.example",
      },
    });

    expect(() => assertSameOrigin(request)).toThrowError("请求来源不受信任");
  });

  it("accepts requests without an Origin header", () => {
    const request = new NextRequest("http://localhost:3000/api/sessions", { method: "POST" });

    expect(() => assertSameOrigin(request)).not.toThrow();
  });
});
