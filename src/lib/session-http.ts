import type { NextRequest } from "next/server";
import { AppError } from "./errors";
import { SESSION_TTL_MS, sessionStore } from "./session-store";

export const SESSION_COOKIE = "tdr_session";

export function sessionCookie(id: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function requireSession(request: NextRequest) {
  const id = request.cookies.get(SESSION_COOKIE)?.value;
  const session = id ? sessionStore.get(id) : undefined;
  if (!session) throw new AppError("SESSION_EXPIRED", "临时会话已过期，请重新开始", 401);
  sessionStore.enforceRate(session);
  return session;
}

export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const host = request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim() || request.nextUrl.protocol;

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(`${protocol.replace(/:$/, "")}://${host}`).origin;
  } catch {
    throw new AppError("ORIGIN_REJECTED", "请求来源不受信任", 403);
  }

  if (origin !== expectedOrigin) {
    throw new AppError("ORIGIN_REJECTED", "请求来源不受信任", 403);
  }
}
