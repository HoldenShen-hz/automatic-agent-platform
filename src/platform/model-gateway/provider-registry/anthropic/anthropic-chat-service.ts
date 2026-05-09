/**
 * @fileoverview Anthropic Chat Service - Chat completion for Claude models
 *
 * ## Overview
 *
 * Provides chat completion functionality using Anthropic's Claude models.
 * Supports Claude 4 (opus, sonnet, haiku) series.
 *
 * ## API Documentation
 *
 * @see {@link https://docs.anthropic.com/claude/reference | Anthropic API Documentation}
 *
 * ## Supported Models
 *
 * - Claude Opus 4: Best quality for complex tasks
 * - Claude Sonnet 4: Balanced performance
 * - Claude Haiku 3.5: Fast, efficient for classification/summarization
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
import { ANTHROPIC_API_URL } from "../../../control-plane/config-center/provider-defaults.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../../control-plane/iam/network-egress-policy.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

export interface AnthropicMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AnthropicTool {
  type: "function";
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicChatCompletionRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  top_p?: number;
  max_tokens: number;
  stream?: boolean;
  tools?: AnthropicTool[];
  tool_choice?: "auto" | "none";
  signal?: AbortSignal;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicChatCompletionChoice {
  message: {
    role: "assistant";
    content: string;
    refusal?: string | null;
  };
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string | null;
}

export interface AnthropicChatCompletionResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{
    type: "text" | "tool_use" | "tool_result" | "refusal";
    text?: string;
    id?: string;
    name?: string;
    input?: Record<string, unknown>;
    tool_use_id?: string;
  }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use";
  stop_sequence?: string | null;
  usage: AnthropicUsage;
}

export interface AnthropicChatCompletionResult {
  id: string;
  content: string;
  refusal: string | null;
  stopReason: string;
  stopSequence: string | null;
  usage: AnthropicUsage;
  model: string;
  rawResponse: AnthropicChatCompletionResponse;
}

export interface AnthropicProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  credentialPool?: ProviderCredentialPool;
  fetchImpl?: typeof fetch;
}

export interface AnthropicEnvironmentConfig {
  providerEnv?: NodeJS.ProcessEnv;
  secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
  secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
  secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  defaultCooldownMs?: number;
}

export interface AnthropicAPIErrorOptions {
  statusCode: number;
  statusText: string;
  message: string;
  type?: string | undefined;
  credentialId?: string | null;
  retryAfterMs?: number | null;
  resetAt?: string | null;
}

export class AnthropicAPIError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly type: string | null;
  public readonly credentialId: string | null;
  public readonly retryAfterMs: number | null;
  public readonly resetAt: string | null;

  public constructor(options: AnthropicAPIErrorOptions) {
    super(options.message);
    this.name = "AnthropicAPIError";
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.type = options.type ?? null;
    this.credentialId = options.credentialId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.resetAt = options.resetAt ?? null;
  }
}

export class AnthropicChatService {
  private readonly baseUrl: string;
  private readonly credentialPool: ProviderCredentialPool;
  private readonly ownsCredentialPool: boolean;
  private readonly fetchImpl: typeof fetch;
  private disposed = false;

  public constructor(config: AnthropicProviderConfig) {
    this.ownsCredentialPool = config.credentialPool == null;
    this.credentialPool =
      config.credentialPool
      ?? new ProviderCredentialPool({
        provider: "anthropic",
        credentials: config.apiKey
          ? [
              {
                credentialId: "anthropic-default",
                apiKey: config.apiKey,
                label: "default",
              },
            ]
          : [],
      });
    const rawFetchImpl = config.fetchImpl ?? fetch;
    this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: "anthropic ChatCompletion" });

    this.baseUrl = config.baseUrl ?? ANTHROPIC_API_URL;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.ownsCredentialPool) {
      this.credentialPool.dispose("provider.anthropic_service_disposed");
    }
  }

  private async postWithCredentialFailover(
    request: AnthropicChatCompletionRequest,
    stream: boolean,
  ): Promise<{
    response: Response;
    selection: ProviderCredentialSelection;
  }> {
    const url = `${this.baseUrl}/v1/messages`;
    const triedCredentialIds: string[] = [];
    const ANTHROPIC_VERSION = "2023-06-01";

    while (true) {
      const selection = await this.credentialPool.selectCredential({
        excludeCredentialIds: triedCredentialIds,
      });
      if (selection == null) {
        const exhaustion = this.credentialPool.getExhaustion();
        throw new AnthropicAPIError({
          statusCode: 503,
          statusText: "Provider Credential Exhausted",
          message: exhaustion.message,
        });
      }
      triedCredentialIds.push(selection.credentialId);

      // Transform request to Anthropic format
      const anthropicRequest = this.transformToAnthropicRequest(request);

      const { signal } = request;
      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": selection.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({ ...anthropicRequest, ...(stream ? { stream: true } : {}) }),
        ...(signal !== undefined ? { signal } : {}),
      });

      if (response.ok) {
        this.credentialPool.markSuccess(selection.credentialId);
        return { response, selection };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers);
      const resetAt = parseResetAt(response.headers, [
        "anthropic-ratelimit-reset",
        "x-ratelimit-reset",
        "reset-at",
      ]);
      const errorText = await response.text();

      let errorType: string | undefined;
      try {
        const errorJson = JSON.parse(errorText);
        errorType = errorJson.type;
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
        shouldRetryWithinPool(response.status, [429, 500, 502, 503, 529])
        && await this.credentialPool.canFailoverAfter({
          statusCode: response.status,
          retryAfterMs,
          resetAt,
          excludeCredentialIds: triedCredentialIds,
        })
      ) {
        continue;
      }

      throw new AnthropicAPIError({
        statusCode: response.status,
        statusText: response.statusText,
        message: `Anthropic API error: ${response.status} ${response.statusText} - ${errorText}`,
        ...(errorType !== undefined ? { type: errorType } : {}),
        credentialId: selection.credentialId,
        ...(retryAfterMs !== null ? { retryAfterMs } : {}),
        ...(resetAt !== null ? { resetAt } : {}),
      });
    }
  }

  private toAnthropicMessageRole(role: AnthropicMessage["role"]): "user" | "assistant" {
    if (role === "user" || role === "assistant") {
      return role;
    }
    throw new ProviderError("provider.invalid_request", "Anthropic message array cannot contain system-role entries after normalization.", {
      source: "provider",
      retryable: false,
    });
  }

  private transformToAnthropicRequest(request: AnthropicChatCompletionRequest): Record<string, unknown> {
    // Extract system message if present
    let systemMessage: string | undefined;
    const anthropicMessages: AnthropicMessage[] = [];

    for (const msg of request.messages) {
      if (msg.role === "system") {
        systemMessage = msg.content;
      } else {
        anthropicMessages.push(msg);
      }
    }

    const result: Record<string, unknown> = {
      model: request.model,
      messages: anthropicMessages.map((m) => ({
        role: this.toAnthropicMessageRole(m.role),
        content: m.content,
      })),
      max_tokens: request.max_tokens,
    };

    if (systemMessage) {
      result.system = systemMessage;
    }

    if (request.temperature !== undefined) {
      result.temperature = request.temperature;
    }

    if (request.top_p !== undefined) {
      result.top_p = request.top_p;
    }

    if (request.tools && request.tools.length > 0) {
      result.tools = request.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
    }

    if (request.tool_choice) {
      result.tool_choice = { type: request.tool_choice };
    }

    return result;
  }

  private extractContent(response: AnthropicChatCompletionResponse): string {
    const textParts: string[] = [];
    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text ?? "");
      }
    }
    return textParts.join("\n");
  }

  private extractRefusal(response: AnthropicChatCompletionResponse): string | null {
    for (const block of response.content) {
      if (block.type === "refusal") {
        return block.text ?? "Refused";
      }
    }
    return null;
  }

  public async createChatCompletion(
    request: AnthropicChatCompletionRequest,
  ): Promise<AnthropicChatCompletionResult> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, false);
    try {
      const data = (await response.json()) as AnthropicChatCompletionResponse;

      return {
        id: data.id,
        content: this.extractContent(data),
        refusal: this.extractRefusal(data),
        stopReason: data.stop_reason,
        stopSequence: data.stop_sequence ?? null,
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
    request: AnthropicChatCompletionRequest,
    onChunk: (chunk: AnthropicChatCompletionResult, isFinal: boolean) => void,
  ): Promise<void> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, true);
    try {
      if (!response.body) {
        throw new AnthropicAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "Anthropic API returned empty response body for streaming",
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedUsage: AnthropicUsage | null = null;
      let accumulatedContent = "";
      let accumulatedRefusal: string | null = null;
      let finalStopReason: string | null = null;
      let finalStopSequence: string | null = null;

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
              // Send final chunk
              onChunk({
                id: "stream-final",
                content: accumulatedContent,
                refusal: accumulatedRefusal,
                stopReason: finalStopReason ?? "end_turn",
                stopSequence: finalStopSequence,
                usage: accumulatedUsage ?? { input_tokens: 0, output_tokens: 0 },
                model: request.model,
                rawResponse: {} as AnthropicChatCompletionResponse,
              }, true);
              return;
            }

            try {
              const parsed = JSON.parse(data) as {
                type: string;
                index?: number;
                content_block?: {
                  type: string;
                  text?: string;
                  refusal?: string;
                };
                message?: AnthropicChatCompletionResponse;
                usage?: AnthropicUsage;
                delta?: {
                  type: string;
                  text?: string;
                  partial_json?: string;
                };
              };

              if (parsed.type === "content_block_delta") {
                if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
                  accumulatedContent += parsed.delta.text;
                }
              } else if (parsed.type === "message_delta") {
                if (parsed.usage) {
                  accumulatedUsage = parsed.usage;
                }
                if (parsed.delta?.type === "text_delta") {
                  // already accumulated above
                }
              } else if (parsed.type === "message") {
                // Final message
                if (parsed.message) {
                  accumulatedContent = this.extractContent(parsed.message);
                  accumulatedRefusal = this.extractRefusal(parsed.message);
                  finalStopReason = parsed.message.stop_reason;
                  finalStopSequence = parsed.message.stop_sequence ?? null;
                  accumulatedUsage = parsed.message.usage;
                }
              } else if (parsed.type === "content_block_start") {
                if (parsed.content_block?.type === "refusal") {
                  accumulatedRefusal = parsed.content_block.refusal ?? "Refused";
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
        stopReason: finalStopReason ?? "end_turn",
        stopSequence: finalStopSequence,
        usage: accumulatedUsage ?? { input_tokens: 0, output_tokens: 0 },
        model: request.model,
        rawResponse: {} as AnthropicChatCompletionResponse,
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
      throw new ProviderError("provider.disposed", "Anthropic chat service has been disposed.", {
        source: "provider",
        retryable: false,
      });
    }
  }
}

export function createAnthropicChatService(apiKey: string, baseUrl?: string): AnthropicChatService {
  const config: AnthropicProviderConfig = { apiKey };
  if (baseUrl != null) {
    config.baseUrl = baseUrl;
  }
  return new AnthropicChatService(config);
}

export function createAnthropicChatServiceFromEnvironment(
  config: AnthropicEnvironmentConfig = {},
): AnthropicChatService {
  const providerEnv = config.providerEnv ?? process.env;
  const serviceConfig: AnthropicProviderConfig = {
    credentialPool: ProviderCredentialPool.fromEnvironment(
      "anthropic",
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
  if (config.fetchImpl != null) {
    serviceConfig.fetchImpl = config.fetchImpl;
  }
  return new AnthropicChatService(serviceConfig);
}
