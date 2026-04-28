/**
 * @fileoverview OpenAI Chat Service - Chat completion for GPT models
 *
 * ## Overview
 *
 * Provides chat completion functionality using OpenAI's GPT models.
 * Supports GPT-4o, GPT-4, GPT-3.5 Turbo series.
 *
 * ## API Documentation
 *
 * @see {@link https://platform.openai.com/docs/api-reference/chat | OpenAI API Documentation}
 *
 * ## Supported Models
 *
 * - GPT-4o: Latest flagship model with vision and function calling
 * - GPT-4 Turbo: High intelligence, faster than GPT-4
 * - GPT-3.5 Turbo: Fast and cost-effective
 */

import {
  ProviderCredentialPool,
  type ProviderCredentialSelection,
  type ProviderCredentialEnvLoadOptions,
} from "../provider-credential-pool.js";
import { ProviderError } from "../../../contracts/errors.js";
import {
  parseResetAt,
  parseRetryAfterMs,
  shouldRetryWithinPool,
} from "../base-chat-provider.js";
import { OPENAI_API_URL } from "../../../control-plane/config-center/provider-defaults.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../../control-plane/iam/network-egress-policy.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface OpenAIFunction {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: OpenAIFunction[];
  tool_choice?: "auto" | "none" | { type: "function"; function: { name: string } };
  response_format?: { type: "text" | "json_object" };
  signal?: AbortSignal;
}

export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChatCompletionChoice {
  message?: {
    role: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
    refusal?: string | null;
  };
  delta?: {
    role?: "assistant";
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: "function";
      function: {
        name: string;
        arguments: string;
      };
    }>;
    refusal?: string | null;
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | "refusal" | null;
  index: number;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: "chat.completion" | "chat.completion.chunk";
  created: number;
  model: string;
  system_fingerprint?: string;
  choices: OpenAIChatCompletionChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIFunctionCallResult {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIChatCompletionResult {
  id: string;
  content: string | null;
  refusal: string | null;
  finishReason: string;
  toolCalls: OpenAIFunctionCallResult[];
  usage: OpenAIUsage;
  model: string;
  rawResponse: OpenAIChatCompletionResponse;
}

export interface OpenAIProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  credentialPool?: ProviderCredentialPool;
  fetchImpl?: typeof fetch;
}

export interface OpenAIEnvironmentConfig {
  providerEnv?: NodeJS.ProcessEnv;
  secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
  secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
  secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
  baseUrl?: string;
  organization?: string;
  fetchImpl?: typeof fetch;
  defaultCooldownMs?: number;
}

export interface OpenAIAPIErrorOptions {
  statusCode: number;
  statusText: string;
  message: string;
  type?: string | undefined;
  code?: string | null;
  credentialId?: string | null;
  retryAfterMs?: number | null;
  resetAt?: string | null;
}

export class OpenAIAPIError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly type: string | null;
  public readonly code: string | null;
  public readonly credentialId: string | null;
  public readonly retryAfterMs: number | null;
  public readonly resetAt: string | null;

  public constructor(options: OpenAIAPIErrorOptions) {
    super(options.message);
    this.name = "OpenAIAPIError";
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.type = options.type ?? null;
    this.code = options.code ?? null;
    this.credentialId = options.credentialId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.resetAt = options.resetAt ?? null;
  }
}

export class OpenAIChatService {
  private readonly baseUrl: string;
  private readonly organization: string | null;
  private readonly credentialPool: ProviderCredentialPool;
  private readonly ownsCredentialPool: boolean;
  private readonly fetchImpl: typeof fetch;
  private disposed = false;

  public constructor(config: OpenAIProviderConfig) {
    this.ownsCredentialPool = config.credentialPool == null;
    this.credentialPool =
      config.credentialPool
      ?? new ProviderCredentialPool({
        provider: "openai",
        credentials: config.apiKey
          ? [
              {
                credentialId: "openai-default",
                apiKey: config.apiKey,
                label: "default",
              },
            ]
          : [],
      });
    const rawFetchImpl = config.fetchImpl ?? fetch;
    this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: "openai ChatCompletion" });
    this.organization = config.organization ?? null;

    this.baseUrl = config.baseUrl ?? OPENAI_API_URL;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.ownsCredentialPool) {
      this.credentialPool.dispose("provider.openai_service_disposed");
    }
  }

  private async postWithCredentialFailover(
    request: OpenAIChatCompletionRequest,
    stream: boolean,
  ): Promise<{
    response: Response;
    selection: ProviderCredentialSelection;
  }> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const triedCredentialIds: string[] = [];

    while (true) {
      const selection = await this.credentialPool.selectCredential({
        excludeCredentialIds: triedCredentialIds,
      });
      if (selection == null) {
        const exhaustion = this.credentialPool.getExhaustion();
        throw new OpenAIAPIError({
          statusCode: 503,
          statusText: "Provider Credential Exhausted",
          message: exhaustion.message,
        });
      }
      triedCredentialIds.push(selection.credentialId);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${selection.apiKey}`,
      };

      if (this.organization) {
        headers["OpenAI-Organization"] = this.organization;
      }

      const { signal, ...requestBody } = request;
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...requestBody, ...(stream ? { stream: true } : {}) }),
        ...(signal !== undefined ? { signal } : {}),
      });

      if (response.ok) {
        this.credentialPool.markSuccess(selection.credentialId);
        return { response, selection };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers);
      const resetAt = parseResetAt(response.headers, [
        "x-ratelimit-reset",
        "reset-at",
        "ratelimit-reset",
      ]);
      const errorText = await response.text();

      let errorType: string | undefined;
      let errorCode: string | null = null;
      try {
        const errorJson = JSON.parse(errorText);
        errorType = errorJson.type;
        errorCode = errorJson.code ?? null;
      } catch (err) {
        logger.log({
          level: "debug",
          message: "Skipped malformed JSON in error response parse",
          data: { error: err instanceof Error ? err.message : String(err) },
        });
      }

      this.credentialPool.markFailure({
        credentialId: selection.credentialId,
        statusCode: response.status,
        errorCode: `provider.http_${response.status}`,
        retryAfterMs,
        resetAt,
      });
      this.credentialPool.releaseCredential(
        { credentialId: selection.credentialId, leaseId: selection.leaseId },
        `provider.http_${response.status}`,
      );

      if (
        shouldRetryWithinPool(response.status, [402, 429, 500, 502, 503, 529])
        && await this.credentialPool.canFailoverAfter({
          statusCode: response.status,
          retryAfterMs,
          resetAt,
          excludeCredentialIds: triedCredentialIds,
        })
      ) {
        continue;
      }

      throw new OpenAIAPIError({
        statusCode: response.status,
        statusText: response.statusText,
        message: `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
        type: errorType,
        code: errorCode ?? null,
        credentialId: selection.credentialId,
        retryAfterMs: retryAfterMs ?? null,
        resetAt: resetAt ?? null,
      });
    }
  }

  private extractContent(response: OpenAIChatCompletionResponse): string | null {
    if (!response.choices || response.choices.length === 0) {
      return null;
    }
    return response.choices[0]?.message?.content ?? null;
  }

  private extractRefusal(response: OpenAIChatCompletionResponse): string | null {
    if (!response.choices || response.choices.length === 0) {
      return null;
    }
    return response.choices[0]?.message?.refusal ?? null;
  }

  private extractToolCalls(response: OpenAIChatCompletionResponse): OpenAIFunctionCallResult[] {
    const toolCalls: OpenAIFunctionCallResult[] = [];
    if (!response.choices || response.choices.length === 0) {
      return toolCalls;
    }
    const message = response.choices[0]?.message;
    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type === "function") {
          toolCalls.push({
            id: tc.id,
            type: "function",
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          });
        }
      }
    }
    return toolCalls;
  }

  public async createChatCompletion(
    request: OpenAIChatCompletionRequest,
  ): Promise<OpenAIChatCompletionResult> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, false);
    try {
      const data = (await response.json()) as OpenAIChatCompletionResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new OpenAIAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "OpenAI API returned no choices",
        });
      }

      return {
        id: data.id,
        content: this.extractContent(data),
        refusal: this.extractRefusal(data),
        finishReason: data.choices[0]?.finish_reason ?? "stop",
        toolCalls: this.extractToolCalls(data),
        usage: data.usage,
        model: data.model,
        rawResponse: data,
      };
    } finally {
      this.credentialPool.releaseCredential(
        { credentialId: selection.credentialId, leaseId: selection.leaseId },
        "provider.request_completed",
      );
    }
  }

  public async createStreamingChatCompletion(
    request: OpenAIChatCompletionRequest,
    onChunk: (chunk: OpenAIChatCompletionResult, isFinal: boolean) => void,
  ): Promise<void> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, true);
    try {
      if (!response.body) {
        throw new OpenAIAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "OpenAI API returned empty response body for streaming",
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedContent = "";
      let accumulatedRefusal: string | null = null;
      let finalFinishReason: string = "stop";
      const accumulatedToolCalls: OpenAIFunctionCallResult[] = [];
      let accumulatedUsage: OpenAIUsage | null = null;
      let firstChunk = true;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) {
              continue;
            }

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              onChunk({
                id: "stream-final",
                content: accumulatedContent,
                refusal: accumulatedRefusal,
                finishReason: finalFinishReason,
                toolCalls: accumulatedToolCalls,
                usage: accumulatedUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                model: request.model,
                rawResponse: {} as OpenAIChatCompletionResponse,
              }, true);
              return;
            }

            try {
              const parsed = JSON.parse(data) as OpenAIChatCompletionResponse;

              if (parsed.choices && parsed.choices.length > 0) {
                const choice = parsed.choices[0]!;

                if (choice.delta !== undefined) {
                  // Streaming chunk
                  if (firstChunk) {
                    firstChunk = false;
                    finalFinishReason = choice.finish_reason ?? "stop";
                  }

                  if (choice.delta.content) {
                    accumulatedContent += choice.delta.content;
                  }
                  if (choice.delta.refusal) {
                    accumulatedRefusal = choice.delta.refusal;
                  }
                  if (choice.delta.tool_calls) {
                    for (const tc of choice.delta.tool_calls) {
                      if (tc.type === "function") {
                        // Find or create tool call
                        const existingIdx = accumulatedToolCalls.findIndex(
                          (t) => t.id === tc.id,
                        );
                        if (existingIdx >= 0) {
                          const existing = accumulatedToolCalls[existingIdx];
                          if (existing) {
                            existing.function.arguments += tc.function.arguments ?? "";
                          }
                        } else {
                          accumulatedToolCalls.push({
                            id: tc.id,
                            type: "function",
                            function: {
                              name: tc.function.name,
                              arguments: tc.function.arguments ?? "",
                            },
                          });
                        }
                      }
                    }
                  }
                } else {
                  // Final chunk
                  finalFinishReason = choice.finish_reason ?? "stop";
                  if (choice.message?.content) {
                    accumulatedContent = choice.message.content;
                  }
                  if (choice.message?.refusal) {
                    accumulatedRefusal = choice.message.refusal;
                  }
                  accumulatedUsage = parsed.usage;
                }

                if (parsed.usage) {
                  accumulatedUsage = parsed.usage;
                }
              }
            } catch (err) {
              logger.log({
                level: "debug",
                message: "Skipped malformed JSON in stream",
                data: { error: err instanceof Error ? err.message : String(err) },
              });
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Send final chunk if we exited loop without [DONE]
      onChunk({
        id: "stream-final",
        content: accumulatedContent,
        refusal: accumulatedRefusal,
        finishReason: finalFinishReason,
        toolCalls: accumulatedToolCalls,
        usage: accumulatedUsage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        model: request.model,
        rawResponse: {} as OpenAIChatCompletionResponse,
      }, true);
    } finally {
      this.credentialPool.releaseCredential(
        { credentialId: selection.credentialId, leaseId: selection.leaseId },
        "provider.stream_completed",
      );
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new ProviderError("provider.disposed", "OpenAI chat service has been disposed.", {
        source: "provider",
        retryable: false,
      });
    }
  }
}

export function createOpenAIChatService(apiKey: string, options?: { baseUrl?: string; organization?: string }): OpenAIChatService {
  const config: OpenAIProviderConfig = { apiKey };
  if (options?.baseUrl != null) {
    config.baseUrl = options.baseUrl;
  }
  if (options?.organization != null) {
    config.organization = options.organization;
  }
  return new OpenAIChatService(config);
}

export function createOpenAIChatServiceFromEnvironment(
  config: OpenAIEnvironmentConfig = {},
): OpenAIChatService {
  const providerEnv = config.providerEnv ?? process.env;
  const serviceConfig: OpenAIProviderConfig = {
    credentialPool: ProviderCredentialPool.fromEnvironment(
      "openai",
      providerEnv,
      config.defaultCooldownMs,
      {
        secretResolver: config.secretResolver ?? null,
        secretLeaseIssuer: config.secretLeaseIssuer ?? null,
        secretLeaseRevoker: config.secretLeaseRevoker ?? null,
      },
    ),
  };
  if (config.baseUrl != null) {
    serviceConfig.baseUrl = config.baseUrl;
  }
  if (config.organization != null) {
    serviceConfig.organization = config.organization;
  }
  if (config.fetchImpl != null) {
    serviceConfig.fetchImpl = config.fetchImpl;
  }
  return new OpenAIChatService(serviceConfig);
}
