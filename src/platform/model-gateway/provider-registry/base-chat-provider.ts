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
import { createPolicyAwareFetch } from "../../five-plane-control-plane/iam/network-egress-policy.js";
import {
  DEFAULT_PROVIDER_ERROR_BODY_BYTES,
  DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS,
  DEFAULT_PROVIDER_RETRYABLE_STATUS_CODES,
} from "../../five-plane-control-plane/config-center/provider-defaults.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const textDecoder = new TextDecoder();

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
  requestTimeoutMs?: number;
  maxErrorBodyBytes?: number;
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
  protected readonly requestTimeoutMs: number;
  protected readonly maxErrorBodyBytes: number;

  public constructor(config: BaseChatProviderConfig) {
    this.providerName = config.providerName;
    this.defaultRetryableCodes = [...(config.defaultRetryableCodes ?? DEFAULT_PROVIDER_RETRYABLE_STATUS_CODES)];
    this.ratelimitResetHeaderNames = config.ratelimitResetHeaderNames ?? ["reset-at", "x-ratelimit-reset"];
    this.requestTimeoutMs = normalizePositiveInteger(config.requestTimeoutMs, DEFAULT_PROVIDER_REQUEST_TIMEOUT_MS);
    this.maxErrorBodyBytes = normalizePositiveInteger(config.maxErrorBodyBytes, DEFAULT_PROVIDER_ERROR_BODY_BYTES);

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
      const body = this.transformRequest(stripTransportControlFields(request), stream);
      const runtimeSignal = buildRuntimeSignal(
        getAbortSignal(request),
        normalizePositiveInteger(getTimeoutMsOverride(request), this.requestTimeoutMs),
      );
      const retryableStatusCodes = getRetryableStatusCodesOverride(request) ?? this.getRetryableStatusCodes();

      const response = await this.fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        ...(runtimeSignal !== undefined ? { signal: runtimeSignal } : {}),
      });

      if (response.ok) {
        this.credentialPool.markSuccess(selection.credentialId);
        return { response, selection };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers);
      const resetAt = parseResetAt(response.headers, this.getRatelimitResetHeaderNames());
      const { text: errorText, truncated } = await readResponseTextLimited(response, this.maxErrorBodyBytes);
      const errorSummary = truncated ? `${errorText} [truncated]` : errorText;

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
        shouldRetryWithinPool(response.status, retryableStatusCodes)
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
        message: `${this.providerName} API error: ${response.status} ${response.statusText} - ${errorSummary}`,
        ...(errorType !== undefined && { errorType }),
        errorCode,
        credentialId: selection.credentialId,
        retryAfterMs: retryAfterMs ?? null,
        resetAt: resetAt ?? null,
        errorText: errorSummary,
      });
    }
  }
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function stripTransportControlFields(request: Record<string, unknown>): Record<string, unknown> {
  const { signal, abortSignal, timeoutMs, retryableStatusCodes, ...rest } = request;
  return rest;
}

function getAbortSignal(request: Record<string, unknown>): AbortSignal | undefined {
  const candidate = request.signal ?? request.abortSignal;
  if (
    typeof candidate === "object"
    && candidate !== null
    && "aborted" in candidate
    && typeof (candidate as AbortSignal).aborted === "boolean"
  ) {
    return candidate as AbortSignal;
  }
  return undefined;
}

function getTimeoutMsOverride(request: Record<string, unknown>): number | undefined {
  const timeoutMs = request.timeoutMs;
  return typeof timeoutMs === "number" ? timeoutMs : undefined;
}

function getRetryableStatusCodesOverride(request: Record<string, unknown>): number[] | undefined {
  const candidate = request.retryableStatusCodes;
  if (!Array.isArray(candidate)) {
    return undefined;
  }
  const normalized = candidate.filter(
    (code): code is number => typeof code === "number" && Number.isInteger(code) && code >= 100 && code <= 599,
  );
  return normalized.length > 0 ? normalized : undefined;
}

function buildRuntimeSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  if (signal == null && timeoutMs <= 0) {
    return undefined;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error("provider.request_timeout"));
  }, timeoutMs);
  timeout.unref?.();

  const onAbort = (): void => {
    controller.abort(signal?.reason);
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }, { once: true });
  return controller.signal;
}

async function readResponseTextLimited(
  response: Response,
  maxBytes: number,
): Promise<{ text: string; truncated: boolean }> {
  const reader = response.body?.getReader();
  if (reader == null) {
    return { text: "", truncated: false };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let truncated = false;

  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done || value == null) {
        break;
      }
      const remaining = maxBytes - totalBytes;
      if (value.byteLength > remaining) {
        chunks.push(value.subarray(0, remaining));
        totalBytes += remaining;
        truncated = true;
        break;
      }
      chunks.push(value);
      totalBytes += value.byteLength;
    }

    if (!truncated) {
      const next = await reader.read();
      truncated = !(next.done ?? false);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  return {
    text: textDecoder.decode(Buffer.concat(chunks)),
    truncated,
  };
}
