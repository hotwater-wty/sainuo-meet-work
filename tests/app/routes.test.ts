import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST as createSession } from "../../src/app/api/sessions/route.js";
import { GET as currentSession } from "../../src/app/api/sessions/current/route.js";
import { POST as importUrl } from "../../src/app/api/sources/import/route.js";
import { POST as uploadSource } from "../../src/app/api/sources/upload/route.js";

async function sessionCookie(): Promise<string> {
  const response = await createSession(new NextRequest("http://localhost/api/sessions", { method: "POST" }));
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")?.split(";")[0] ?? "";
}

describe("P2 route contract", () => {
  it("restores a session through its HttpOnly cookie", async () => {
    const cookie = await sessionCookie();
    const response = await currentSession(
      new NextRequest("http://localhost/api/sessions/current", { headers: { cookie } }),
    );
    const body = (await response.json()) as { session: { id: string } };
    expect(response.status).toBe(200);
    expect(body.session.id).toBeTruthy();
  });

  it("creates a distinct session when the user starts a new conversation", async () => {
    const originalCookie = await sessionCookie();
    const originalResponse = await currentSession(
      new NextRequest("http://localhost/api/sessions/current", { headers: { cookie: originalCookie } }),
    );
    const original = (await originalResponse.json()) as { session: { id: string } };

    const nextResponse = await createSession(
      new NextRequest("http://localhost/api/sessions?new=1", {
        method: "POST",
        headers: { cookie: originalCookie },
      }),
    );
    const next = (await nextResponse.json()) as { session: { id: string } };

    expect(nextResponse.status).toBe(200);
    expect(next.session.id).not.toBe(original.session.id);
    expect(nextResponse.headers.get("set-cookie")).toContain(next.session.id);
  });

  it("uploads a text source and refuses an unconfirmed replacement", async () => {
    const cookie = await sessionCookie();
    const form = new FormData();
    form.set("file", new File(["protocol evidence"], "notes.txt", { type: "text/plain" }));
    const first = await uploadSource(
      new NextRequest("http://localhost/api/sources/upload", {
        method: "POST",
        headers: { cookie },
        body: form,
      }),
    );
    expect(first.status).toBe(201);

    const secondForm = new FormData();
    secondForm.set("file", new File(["replacement"], "next.txt", { type: "text/plain" }));
    const second = await uploadSource(
      new NextRequest("http://localhost/api/sources/upload", {
        method: "POST",
        headers: { cookie },
        body: secondForm,
      }),
    );
    expect(second.status).toBe(409);
  });

  it("rejects a private URL before fetching content", async () => {
    const cookie = await sessionCookie();
    const response = await importUrl(
      new NextRequest("http://localhost/api/sources/import", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ url: "http://127.0.0.1/admin", replace: false }),
      }),
    );
    const body = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("UNSAFE_URL");
  });
});
