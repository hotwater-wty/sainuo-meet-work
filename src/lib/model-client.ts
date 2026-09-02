import { AppError } from "./errors";

export interface ModelUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ModelCompletion {
  text: string;
  usage?: ModelUsage;
}

export interface CompleteRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  thinking?: boolean;
}

export interface ModelClient {
  complete(request: CompleteRequest): Promise<ModelCompletion>;
  stream?(request: CompleteRequest): AsyncIterable<string>;
}

interface ChatPayload {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string };
}

export class OpenAICompatibleModelClient implements ModelClient {
  private readonly endpoint: string;

  constructor(
    baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs = 60_000,
    private readonly defaultThinking = false,
  ) {
    this.endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  }

  async complete(request: CompleteRequest): Promise<ModelCompletion> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 3_000,
        enable_thinking: request.thinking ?? this.defaultThinking,
        ...(request.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as ChatPayload;
    if (!response.ok) throw this.apiError(response.status, payload);
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new AppError("MODEL_EMPTY", "模型没有返回有效内容，请重试", 502, true);
    return {
      text,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            completionTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *stream(request: CompleteRequest): AsyncIterable<string> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: this.headers(),
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model: this.model,
        temperature: request.temperature ?? 0.3,
        max_tokens: request.maxTokens ?? 2_400,
        enable_thinking: request.thinking ?? this.defaultThinking,
        stream: true,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.user },
        ],
      }),
    });
    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => ({}))) as ChatPayload;
      throw this.apiError(response.status, payload);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const event = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const token = event.choices?.[0]?.delta?.content;
        if (token) yield token;
      }
      if (done) break;
    }
  }

  private headers(): HeadersInit {
    return { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" };
  }

  private apiError(status: number, payload: ChatPayload): AppError {
    const retryable = status === 408 || status === 429 || status >= 500;
    const code = payload.error?.code ? `MODEL_${payload.error.code}` : "MODEL_API_ERROR";
    return new AppError(code, retryable ? "模型服务繁忙，请稍后重试" : "模型请求被拒绝，请检查配置", 502, retryable);
  }
}

export function getModelClient(): ModelClient {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new AppError("MODEL_NOT_CONFIGURED", "模型服务尚未配置", 503);
  }
  return new OpenAICompatibleModelClient(
    baseUrl,
    apiKey,
    model,
    Number(process.env.LLM_TIMEOUT_MS ?? 60_000),
    process.env.LLM_ENABLE_THINKING === "true",
  );
}

export function stripJsonFence(value: string): string {
  return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}
