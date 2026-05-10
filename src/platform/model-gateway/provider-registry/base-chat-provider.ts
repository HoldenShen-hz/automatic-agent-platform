/**
 * @fileoverview Base Chat Provider - Shared infrastructure for LLM chat providers.
 *
 * Extracts common patterns from anthropic/openai/minimax-chat-service.ts:
 * - parseRetryAfterMs() - Rate-limit header parsing
 * - parseResetAt() - Reset-time header parsing
 * - shouldRetryWithinPool() - Retry eligibility determination
 * - BaseAPIError class - Shared error structure
 * - postWithCredentialFailover() - Credential failover logic
 *
 * Each provider extends this base class and implements:
 * - buildRequest(): Transform provider-agnostic request to provider-specific format
 * - extractContent(): Extract text content from provider response
 * - getRatelimitResetHeaders(): Provider-specific rate-limit header names
 * - getStatusCodesToRetry(): Provider-specific retry-eligible status codes
 */

import {
  ProviderCredentialPool,
  type ProviderCredentialSelection,
} from "./provider-credential-pool.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { createPolicyAwareFetch } from "../../control-plane/iam/network-egress-policy.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Base API Error shared by all providers.
 */
export interface BaseAPIErrorOptions {
  statusCode: number;
  statusText: string;
  message: string;
  type?: string | undefined;
  code?: string | null;
  credentialId?: string | null;
  retryAfterMs?: number | null;
  resetAt?: string | null;
}

export class BaseAPIError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly type: string | null;
  public readonly code: string | null;
  public readonly credentialId: string | null;
  public readonly retryAfterMs: number | null;
  public readonly resetAt: string | null;

  public constructor(options: BaseAPIErrorOptions) {
    super(options.message);
    this.name = "BaseAPIError";
    this.statusCode = options.statusCode;
    this.statusText = options.statusText;
    this.type = options.type ?? null;
    this.code = options.code ?? null;
    this.credentialId = options.credentialId ?? null;
    this.retryAfterMs = options.retryAfterMs ?? null;
    this.resetAt = options.resetAt ?? null;
  }
}

/**
 * Parses retry-after information from response headers.
 * Supports retry-after-ms (milliseconds), retry-after (seconds), and absolute Date values.
 */
export function parseRetryAfterMs(headers: Headers): number | null {
  const retryAfterMs = headers.get("retry-after-ms");
  if (retryAfterMs != null) {
    const parsed = Number(retryAfterMs);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const retryAfter = headers.get("retry-after");
  if (retryAfter == null) {
    return null;
  }

  const parsedSeconds = Number(retryAfter);
  if (Number.isFinite(parsedSeconds) && parsedSeconds >= 0) {
    return parsedSeconds * 1000;
  }

  const retryAt = new Date(retryAfter);
  if (!Number.isNaN(retryAt.getTime())) {
    const diff = retryAt.getTime() - Date.now();
    return diff > 0 ? diff : 0;
  }

  return null;
}

/**
 * Parses rate-limit reset time from response headers.
 * Supports ISO date strings and Unix timestamps (seconds or milliseconds).
 */
export function parseResetAt(headers: Headers, headerNames: string[]): string | null {
  for (const name of headerNames) {
    const value = headers.get(name);
    if (value != null && value.trim().length > 0) {
      const asDate = new Date(value);
      if (!Number.isNaN(asDate.getTime())) {
        return asDate.toISOString();
      }

      const asNumber = Number(value);
      if (Number.isFinite(asNumber)) {
        return new Date(asNumber > 10_000_000_000 ? asNumber : asNumber * 1000).toISOString();
      }
    }
  }
  return null;
}

/**
 * Determines whether a HTTP status code is eligible for retry within the credential pool.
 * Covers rate-limit (429), server errors (5xx), and payment-required (402) codes.
 */
export function shouldRetryWithinPool(statusCode: number, retryableCodes: number[]): boolean {
  return retryableCodes.includes(statusCode);
}

/**
 * Shared request options for all chat providers.
 */
export interface BaseChatProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  credentialPool?: ProviderCredentialPool;
  fetchImpl?: typeof fetch;
  providerName: string;
  defaultRetryableCodes?: number[];
  ratelimitResetHeaderNames?: string[];
}

/**
 * Base class for chat completion providers.
 * Handles credential management, retry logic, and failover.
 */
export abstract class BaseChatProvider {
  protected readonly baseUrl: string;
  protected readonly credentialPool: ProviderCredentialPool;
  protected readonly fetchImpl: typeof fetch;
  protected readonly providerName: string;
  protected readonly defaultRetryableCodes: number[];
  protected readonly ratelimitResetHeaderNames: string[];

  public constructor(config: BaseChatProviderConfig) {
    this.providerName = config.providerName;
    this.defaultRetryableCodes = config.defaultRetryableCodes ?? [402, 429, 500, 502, 503, 529];
    this.ratelimitResetHeaderNames = config.ratelimitResetHeaderNames ?? ["reset-at", "x-ratelimit-reset"];

    this.credentialPool =
      config.credentialPool
      ?? new ProviderCredentialPool({
        provider: config.providerName,
        credentials: config.apiKey
          ? [
              {
                credentialId: `${config.providerName}-default`,
                apiKey: config.apiKey,
                label: "default",
              },
            ]
          : [],
      });

    const rawFetchImpl = config.fetchImpl ?? fetch;
    this.fetchImpl = createPolicyAwareFetch(rawFetchImpl, { action: `${config.providerName} ChatCompletion` });

    this.baseUrl = config.baseUrl ?? this.getDefaultBaseUrl();
  }

  /**
   * Returns the default base URL for this provider.
   */
  protected abstract getDefaultBaseUrl(): string;

  /**
   * Returns the API endpoint path for chat completions.
   */
  protected abstract getChatCompletionPath(): string;

  /**
   * Returns the list of HTTP status codes that should trigger a retry.
   */
  protected getRetryableStatusCodes(): number[] {
    return this.defaultRetryableCodes;
  }

  /**
   * Returns the header names to check for rate-limit reset time.
   */
  protected getRatelimitResetHeaderNames(): string[] {
    return this.ratelimitResetHeaderNames;
  }

  /**
   * Builds provider-specific headers for the request.
   * @param apiKey - The API key selected from the credential pool
   */
  protected abstract buildHeaders(apiKey: string): Record<string, string>;

  /**
   * Transforms the provider-agnostic request to provider-specific format.
   */
  protected abstract transformRequest(request: Record<string, unknown>, stream: boolean): Record<string, unknown>;

  /**
   * Creates a provider-specific API error.
   */
  protected abstract createApiError(options: {
    statusCode: number;
    statusText: string;
    message: string;
    errorType?: string;
    errorCode?: string | null;
    credentialId: string | null;
    retryAfterMs: number | null;
    resetAt: string | null;
    errorText: string;
  }): BaseAPIError;

  /**
   * Shared POST logic with credential failover.
   */
  protected async postWithCredentialFailover(
    request: Record<string, unknown>,
    stream: boolean,
  ): Promise<{
    response: Response;
    selection: ProviderCredentialSelection;
  }> {
    const url = `${this.baseUrl}${this.getChatCompletionPath()}`;
    const triedCredentialIds: string[] = [];

    while (true) {
      const selection = await this.credentialPool.selectCredential({
        excludeCredentialIds: triedCredentialIds,
      });
      if (selection == null) {
        const exhaustion = this.credentialPool.getExhaustion();
        throw this.createApiError({
          statusCode: 503,
          statusText: "Provider Credential Exhausted",
          message: exhaustion.message,
          credentialId: null,
          retryAfterMs: null,
          resetAt: null,
          errorText: exhaustion.message,
        });
      }
      triedCredentialIds.push(selection.credentialId);

      const headers = this.buildHeaders(selection.apiKey);
      const body = this.transformRequest({
        ...request,
        ...(stream && !("stream" in request) ? { stream: true } : {}),
      }, stream);

      const response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        this.credentialPool.markSuccess(selection.credentialId);
        return { response, selection };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers);
      const resetAt = parseResetAt(response.headers, this.getRatelimitResetHeaderNames());
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
          message: `Skipped malformed JSON in ${this.providerName} error response`,
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
        shouldRetryWithinPool(response.status, this.getRetryableStatusCodes())
        && await this.credentialPool.canFailoverAfter({
          statusCode: response.status,
          retryAfterMs,
          resetAt,
          excludeCredentialIds: triedCredentialIds,
        })
      ) {
        continue;
      }

      throw this.createApiError({
        statusCode: response.status,
        statusText: response.statusText,
        message: `${this.providerName} API error: ${response.status} ${response.statusText} - ${errorText}`,
        ...(errorType !== undefined && { errorType }),
        errorCode,
        credentialId: selection.credentialId,
        retryAfterMs: retryAfterMs ?? null,
        resetAt: resetAt ?? null,
        errorText,
      });
    }
  }
}
