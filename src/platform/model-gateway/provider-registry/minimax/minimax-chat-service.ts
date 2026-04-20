/**
 * @fileoverview MiniMax Chat Service - Chat completion for MiniMax AI models
 *
 * ## Overview
 *
 * Provides chat completion functionality using MiniMax's AI models.
 * Supports MiniMax-M2 (reasoning), MiniMax-M1 (reasoning), and MiniMax-Text-01 (standard).
 *
 * ## API Documentation
 *
 * @see {@link https://platform.minimax.io/docs | MiniMax Platform Documentation}
 *
 * ## Supported Models
 *
 * - `MiniMax-M2`: Reasoning model (best quality)
 * - `MiniMax-M1`: Reasoning model (balanced)
 * - `MiniMax-Text-01`: Standard model (fastest)
 *
 * ## Region Support
 *
 * - China: `https://api.minimax.io/v1/text/chatcompletion_v2`
 * - Global: `https://api.minimaxi.com/v1/text/chatcompletion_v2`
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
import {
  MINIMAX_API_URL_CHINA,
  MINIMAX_API_URL_GLOBAL,
} from "../../../control-plane/config-center/provider-defaults.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../../control-plane/iam/network-egress-policy.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

function normalizeMiniMaxBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

export interface MiniMaxMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface MiniMaxChatCompletionRequest {
  model: string;
  messages: MiniMaxMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: MiniMaxTool[];
  tool_choice?: "auto" | "none";
}

export interface MiniMaxTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface MiniMaxUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface MiniMaxChatCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      role: "assistant";
      content: string;
      reasoning_content?: string;
    };
    finish_reason: string;
  }>;
  usage: MiniMaxUsage;
  model?: string;
  created?: number;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export interface MiniMaxChatCompletionResult {
  id: string;
  content: string;
  reasoningContent: string | null;
  finishReason: string;
  usage: MiniMaxUsage;
  model: string;
}

function normalizeUsage(usage: MiniMaxUsage | undefined): MiniMaxUsage {
  return {
    prompt_tokens: usage?.prompt_tokens ?? 0,
    completion_tokens: usage?.completion_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
  };
}

function assertMiniMaxBusinessSuccess(
  data: MiniMaxChatCompletionResponse,
  response: Response,
): void {
  const statusCode = data.base_resp?.status_code ?? 0;
  if (statusCode === 0 || statusCode === 200) {
    return;
  }

  throw new MiniMaxAPIError({
    statusCode: response.status,
    statusText: response.statusText,
    message: `MiniMax API business error: ${statusCode}${data.base_resp?.status_msg ? ` - ${data.base_resp.status_msg}` : ""}`,
  });
}

export interface MiniMaxProviderConfig {
  apiKey?: string;
  region?: "china" | "global" | undefined;
  baseUrl?: string | undefined;
  credentialPool?: ProviderCredentialPool;
  fetchImpl?: typeof fetch;
}

export interface MiniMaxEnvironmentConfig {
  providerEnv?: NodeJS.ProcessEnv;
  secretResolver?: ProviderCredentialEnvLoadOptions["secretResolver"];
  secretLeaseIssuer?: ProviderCredentialEnvLoadOptions["secretLeaseIssuer"];
  secretLeaseRevoker?: ProviderCredentialEnvLoadOptions["secretLeaseRevoker"];
  region?: "china" | "global";
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  defaultCooldownMs?: number;
}

export interface MiniMaxAPIErrorOptions {
  statusCode: number;
  statusText: string;
  message: string;
  credentialId?: string | null;
  retryAfterMs?: number | null;
  resetAt?: string | null;
}

export class MiniMaxAPIError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly credentialId: string | null;
  public readonly retryAfterMs: number | null;
  public readonly resetAt: string | null;

  public constructor(options: MiniMaxAPIErrorOptions) {
    super(options.message);
    this.name = "MiniMaxAPIError";
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.credentialId = options.credentialId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.resetAt = options.resetAt ?? null;
  }
}

export class MiniMaxChatService {
  private readonly baseUrl: string;
  private readonly credentialPool: ProviderCredentialPool;
  private readonly ownsCredentialPool: boolean;
  private readonly fetchImpl: typeof fetch;
  private disposed = false;

  public constructor(config: MiniMaxProviderConfig) {
    this.ownsCredentialPool = config.credentialPool == null;
    this.credentialPool =
      config.credentialPool ??
      new ProviderCredentialPool({
        provider: "minimax",
        credentials: config.apiKey
          ? [
              {
                credentialId: "minimax-default",
                apiKey: config.apiKey,
                label: "default",
              },
            ]
          : [],
      });
    const rawFetchImpl = config.fetchImpl ?? fetch;
    this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: "minimax ChatCompletion" });

    if (config.baseUrl) {
      this.baseUrl = normalizeMiniMaxBaseUrl(config.baseUrl);
    } else if (config.region === "global") {
      this.baseUrl = normalizeMiniMaxBaseUrl(MINIMAX_API_URL_GLOBAL);
    } else {
      this.baseUrl = normalizeMiniMaxBaseUrl(MINIMAX_API_URL_CHINA);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.ownsCredentialPool) {
      this.credentialPool.dispose("provider.minimax_service_disposed");
    }
  }

  private async postWithCredentialFailover(
    request: MiniMaxChatCompletionRequest,
    stream: boolean,
  ): Promise<{
    response: Response;
    selection: ProviderCredentialSelection;
  }> {
    const url = `${this.baseUrl}/text/chatcompletion_v2`;
    const triedCredentialIds: string[] = [];

    while (true) {
      const selection = await this.credentialPool.selectCredential({
        excludeCredentialIds: triedCredentialIds,
      });
      if (selection == null) {
        const exhaustion = this.credentialPool.getExhaustion();
        throw new MiniMaxAPIError({
          statusCode: 503,
          statusText: "Provider Credential Exhausted",
          message: exhaustion.message,
        });
      }
      triedCredentialIds.push(selection.credentialId);

      const response = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${selection.apiKey}`,
        },
        body: JSON.stringify({ ...request, ...(stream ? { stream: true } : {}) }),
      });

      if (response.ok) {
        this.credentialPool.markSuccess(selection.credentialId);
        return { response, selection };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers);
      const resetAt = parseResetAt(response.headers, [
        "x-ratelimit-reset",
        "x-reset-at",
        "reset-at",
        "reset_at",
      ]);
      const errorText = await response.text();

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
        shouldRetryWithinPool(response.status, [402, 429, 500, 502, 503, 504]) &&
        await this.credentialPool.canFailoverAfter({
          statusCode: response.status,
          retryAfterMs,
          resetAt,
          excludeCredentialIds: triedCredentialIds,
        })
      ) {
        continue;
      }

      throw new MiniMaxAPIError({
        statusCode: response.status,
        statusText: response.statusText,
        message: `MiniMax API error: ${response.status} ${response.statusText} - ${errorText}`,
        credentialId: selection.credentialId,
        retryAfterMs,
        resetAt,
      });
    }
  }

  public async createChatCompletion(
    request: MiniMaxChatCompletionRequest,
  ): Promise<MiniMaxChatCompletionResult> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, false);
    try {
      const data = (await response.json()) as MiniMaxChatCompletionResponse;
      assertMiniMaxBusinessSuccess(data, response);

      if (!data.choices || data.choices.length === 0) {
        throw new MiniMaxAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "MiniMax API returned no choices",
        });
      }

      const choice = data.choices[0];
      if (!choice) {
        throw new MiniMaxAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "MiniMax API returned empty choice",
        });
      }

      return {
        id: data.id,
        content: choice.message.content,
        reasoningContent: choice.message.reasoning_content ?? null,
        finishReason: choice.finish_reason,
        usage: normalizeUsage(data.usage),
        model: data.model ?? request.model,
      };
    } finally {
      this.credentialPool.releaseCredential(
        { credentialId: selection.credentialId, leaseId: selection.leaseId },
        "provider.request_completed",
      );
    }
  }

  public async createStreamingChatCompletion(
    request: MiniMaxChatCompletionRequest,
    onChunk: (chunk: MiniMaxChatCompletionResult) => void,
  ): Promise<void> {
    this.assertNotDisposed();
    const { response, selection } = await this.postWithCredentialFailover(request, true);
    try {
      if (!response.body) {
        throw new MiniMaxAPIError({
          statusCode: response.status,
          statusText: response.statusText,
          message: "MiniMax API returned empty response body for streaming",
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              return;
            }

            try {
              const parsed = JSON.parse(data) as MiniMaxChatCompletionResponse;
              assertMiniMaxBusinessSuccess(parsed, response);
              if (parsed.choices && parsed.choices.length > 0) {
                const choice = parsed.choices[0];
                if (choice) {
                  onChunk({
                    id: parsed.id,
                    content: choice.message.content,
                    reasoningContent: choice.message.reasoning_content ?? null,
                    finishReason: choice.finish_reason,
                    usage: normalizeUsage(parsed.usage),
                    model: parsed.model ?? request.model,
                  });
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
    } finally {
      this.credentialPool.releaseCredential(
        { credentialId: selection.credentialId, leaseId: selection.leaseId },
        "provider.stream_completed",
      );
    }
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new ProviderError("provider.disposed", "MiniMax chat service has been disposed.", {
        source: "provider",
        retryable: false,
      });
    }
  }
}

export function createMiniMaxChatService(apiKey: string, region?: "china" | "global"): MiniMaxChatService {
  const config: MiniMaxProviderConfig = { apiKey };
  if (region != null) {
    config.region = region;
  }
  return new MiniMaxChatService(config);
}

export function createMiniMaxChatServiceFromEnvironment(
  config: MiniMaxEnvironmentConfig = {},
): MiniMaxChatService {
  const providerEnv = config.providerEnv ?? process.env;
  const serviceConfig: MiniMaxProviderConfig = {
    credentialPool: ProviderCredentialPool.fromEnvironment(
      "minimax",
      providerEnv,
      config.defaultCooldownMs,
      {
        secretResolver: config.secretResolver ?? null,
        secretLeaseIssuer: config.secretLeaseIssuer ?? null,
        secretLeaseRevoker: config.secretLeaseRevoker ?? null,
      },
    ),
  };
  if (config.region != null) {
    serviceConfig.region = config.region;
  }
  if (config.baseUrl != null) {
    serviceConfig.baseUrl = config.baseUrl;
  }
  if (config.fetchImpl != null) {
    serviceConfig.fetchImpl = config.fetchImpl;
  }
  return new MiniMaxChatService(serviceConfig);
}
