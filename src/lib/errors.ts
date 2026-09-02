import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly retryable = false,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, retryable: error.retryable } },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: error.issues[0]?.message ?? "请求参数无效",
          retryable: false,
        },
      },
      { status: 400 },
    );
  }
  console.error("Unhandled route error", error instanceof Error ? error.message : error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试", retryable: true } },
    { status: 500 },
  );
}
