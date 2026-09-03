import { randomUUID } from "node:crypto";
import type { SessionState, SessionView, SourceRecord } from "./types";
import { AppError } from "./errors";

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class SessionStore {
  private readonly sessions = new Map<string, SessionState>();

  constructor(
    private readonly ttlMs = SESSION_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  create(): SessionState {
    this.cleanup();
    const timestamp = this.now();
    const state: SessionState = {
      id: randomUUID(),
      createdAt: new Date(timestamp).toISOString(),
      lastAccessedAt: new Date(timestamp).toISOString(),
      expiresAt: new Date(timestamp + this.ttlMs).toISOString(),
      notes: [],
      requestLog: [],
    };
    this.sessions.set(state.id, state);
    return state;
  }

  get(id: string, touch = true): SessionState | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;
    const timestamp = this.now();
    if (Date.parse(session.expiresAt) <= timestamp) {
      this.sessions.delete(id);
      return undefined;
    }
    if (touch) {
      session.lastAccessedAt = new Date(timestamp).toISOString();
      session.expiresAt = new Date(timestamp + this.ttlMs).toISOString();
    }
    return session;
  }

  delete(id: string): boolean {
    return this.sessions.delete(id);
  }

  replaceSource(session: SessionState, source: SourceRecord, replace: boolean): void {
    if (session.source && !replace) {
      throw new AppError("SOURCE_EXISTS", "当前会话已有文档，请确认后再替换", 409);
    }
    session.source = source;
    session.profile = undefined;
    session.plan = undefined;
    session.notes = [];
  }

  enforceRate(session: SessionState, limit = 30, windowMs = 60_000): void {
    const cutoff = this.now() - windowMs;
    session.requestLog = session.requestLog.filter((timestamp) => timestamp > cutoff);
    if (session.requestLog.length >= limit) {
      throw new AppError("RATE_LIMITED", "请求过于频繁，请稍后再试", 429, true);
    }
    session.requestLog.push(this.now());
  }

  cleanup(): number {
    const timestamp = this.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (Date.parse(session.expiresAt) <= timestamp) {
        this.sessions.delete(id);
        removed += 1;
      }
    }
    return removed;
  }
}

const globalStore = globalThis as typeof globalThis & { __technicalDocSessionStore?: SessionStore };
export const sessionStore =
  globalStore.__technicalDocSessionStore ?? (globalStore.__technicalDocSessionStore = new SessionStore());

export function toSessionView(session: SessionState): SessionView {
  return {
    id: session.id,
    expiresAt: session.expiresAt,
    source: session.source?.metadata,
    profile: session.profile,
    plan: session.plan,
    notes: session.notes,
  };
}
