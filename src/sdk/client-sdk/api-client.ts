/**
 * @fileoverview Client SDK - Extended API Client
 *
 * Implements §22.1 Client SDK: API client with retry, pagination, and error handling.
 * R8-19 FIX: ContractEnvelope wrapper for inter-plane messages.
 */

import { ValidationError } from "../../platform/contracts/errors.js";
import {
  type ContractEnvelope,
  createContractEnvelope,
  signContractEnvelope,
  verifyContractEnvelopeSignature,
  type ContractEnvelopeVerificationResult,
  nowIso,
  newId,
} from "../../platform/contracts/executable-contracts/index.js";

export interface ApiClientConfig {
  baseUrl: string;
  apiVersion: string;
  tenantId?: string;
  bearerToken?: string;
  timeoutMs?: number;
  maxRetries?: number;
  platformVersion?: string;
  sdkVersion?: string;
  contractVersion?: string;
}

export interface ApiRequestSpec {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export interface PaginationSpec {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  status: number;
  headers: Record<string, string>;
  nextCursor: string | null;
  totalCount?: number;
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: 1000,
  backoffMultiplier: 2,
  maxBackoffMs: 30000,
};

/**
 * Build a versioned API URL with query parameters and tenant context.
 */
export function buildApiUrl(config: ApiClientConfig, request: ApiRequestSpec): string {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const apiVersion = config.apiVersion.replace(/^\/+|\/+$/g, "");
  const path = request.path.replace(/^\/+/, "");
  const url = new URL(`${baseUrl}/${apiVersion}/${path}`);

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value == null) continue;
    url.searchParams.set(key, String(value));
  }
  if (config.tenantId?.trim()) {
    url.searchParams.set("tenantId", config.tenantId.trim());
  }
  return url.toString();
}

/**
 * Build authorization headers for API requests.
 */
export function buildAuthHeaders(config: ApiClientConfig): Record<string, string> {
  if (!config.bearerToken?.trim()) {
    throw new ValidationError("client_sdk.missing_bearer_token", "Client SDK requests require a bearer token.");
  }
  return {
    authorization: `Bearer ${config.bearerToken.trim()}`,
    ...(config.platformVersion ? { "X-Platform-Version": config.platformVersion } : {}),
    ...(config.sdkVersion ? { "X-SDK-Version": config.sdkVersion } : {}),
    ...(config.contractVersion ? { "X-Contract-Version": config.contractVersion } : {}),
  };
}

/**
 * Retry client with exponential backoff for resilient API calls.
 */
export class RetryableApiClient {
  private readonly config: ApiClientConfig;
  private readonly retryConfig: RetryConfig;

  constructor(config: ApiClientConfig, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    this.config = config;
    this.retryConfig = retryConfig;
  }

  /**
   * Make a GET request with automatic retry.
   */
  async get<T>(path: string, query?: Record<string, string | number | boolean | null | undefined>): Promise<ApiResponse<T>> {
    return this.request<T>({ path, method: "GET", ...(query !== undefined ? { query } : {})});
  }

  /**
   * Make a POST request with automatic retry.
   */
  async post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ path, method: "POST", body });
  }

  /**
   * Make a PUT request with automatic retry.
   */
  async put<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ path, method: "PUT", body });
  }

  async patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return this.request<T>({ path, method: "PATCH", body });
  }

  /**
   * Make a DELETE request with automatic retry.
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>({ path, method: "DELETE" });
  }

  /**
   * Make a paginated request.
   */
  async getPaginated<T>(
    path: string,
    pagination?: PaginationSpec,
  ): Promise<PaginatedResponse<T>> {
    const query: Record<string, string | number | boolean | null | undefined> = {
      ...pagination?.cursor ? { cursor: pagination.cursor } : {},
      ...pagination?.limit ? { limit: pagination.limit } : {},
    };

    const response = await this.get<T[]>(path, query);
    const nextCursor = response.headers["x-next-cursor"] ?? null;
    const totalCountHeader = response.headers["x-total-count"];
    const totalCount = totalCountHeader !== undefined ? parseInt(totalCountHeader, 10) : undefined;

    const result: PaginatedResponse<T> = {
      data: response.data,
      status: response.status,
      headers: response.headers,
      nextCursor: nextCursor as string | null,
    };
    if (totalCount !== undefined) {
      (result as { totalCount?: number }).totalCount = totalCount;
    }
    return result;
  }

  async listHarnessRuns<T>(pagination?: PaginationSpec): Promise<PaginatedResponse<T>> {
    return this.getPaginated<T>("/harness-runs", pagination);
  }

  async createHarnessRun<T>(body: unknown): Promise<ApiResponse<T>> {
    return this.post<T>("/harness-runs", body);
  }

  async pauseHarnessRun<T>(runId: string, reason?: string): Promise<ApiResponse<T>> {
    return this.post<T>(`/harness-runs/${encodeURIComponent(runId)}/pause`, reason == null ? {} : { reason });
  }

  async abortHarnessRun<T>(runId: string, reason?: string): Promise<ApiResponse<T>> {
    return this.post<T>(`/harness-runs/${encodeURIComponent(runId)}/abort`, reason == null ? {} : { reason });
  }

  async listPacks<T>(pagination?: PaginationSpec): Promise<PaginatedResponse<T>> {
    return this.getPaginated<T>("/packs", pagination);
  }

  async publishPack<T>(packId: string, body: unknown): Promise<ApiResponse<T>> {
    return this.post<T>(`/packs/${encodeURIComponent(packId)}/publish`, body);
  }

  // R8-19 FIX: ContractEnvelope wrapper for inter-plane messages
  /**
   * Create a ContractEnvelope wrapper for inter-plane messages.
   * All inter-plane messages must carry schemaVersion/commandId/correlationId/signature
   * per the five-plane boundary contract per §5.5.
   */
  createEnvelope<TPayload>(payload: TPayload, metadata?: Readonly<Record<string, string>>, ttl?: number | null): ContractEnvelope<TPayload> {
    return createContractEnvelope({
      payload,
      metadata: metadata ?? {},
      ttl: ttl ?? 30000,
    });
  }

  /**
   * Sign a ContractEnvelope for inter-plane delivery using HMAC-SHA256.
   */
  signEnvelope<TPayload>(envelope: ContractEnvelope<TPayload>, secretKey: string): ContractEnvelope<TPayload> {
    return signContractEnvelope(envelope, secretKey);
  }

  /**
   * Verify a ContractEnvelope signature for authenticity.
   */
  verifyEnvelope<TPayload>(envelope: ContractEnvelope<TPayload>, secretKey: string): ContractEnvelopeVerificationResult {
    return verifyContractEnvelopeSignature(envelope, secretKey);
  }

  /**
   * Send a wrapped ContractEnvelope request with automatic retry.
   */
  async sendEnvelope<TResponse, TPayload>(
    path: string,
    envelope: ContractEnvelope<TPayload>,
    secretKey?: string,
  ): Promise<ApiResponse<TResponse>> {
    const signedEnvelope = secretKey ? this.signEnvelope(envelope, secretKey) : envelope;
    return this.post<TResponse>(path, signedEnvelope);
  }

  // R8-20 FIX: Event subscription/streaming API
  /**
   * Event subscription callback type.
   */
  type EventSubscriptionCallback<TEvent> = (event: TEvent) => void | Promise<void>;

  /**
   * Event subscription handle for unsubscribe.
   */
  interface EventSubscription<TEvent> {
    unsubscribe(): void;
    closed: boolean;
  }

  /**
   * Subscribe to domain events via Server-Sent Events (SSE).
   * Returns a subscription handle with unsubscribe method.
   */
  subscribeToEvents<TEvent>(
    path: string,
    callback: EventSubscriptionCallback<TEvent>,
    options?: {
      eventTypes?: readonly string[];
      filter?: Record<string, string>;
    },
  ): EventSubscription<TEvent> {
    let closed = false;
    let abortController: AbortController | null = null;

    const buildSseUrl = () => {
      const url = new URL(`${this.config.baseUrl.replace(/\/+$/, "")}/${this.config.apiVersion.replace(/^\/+|\/+$/g, "")}${path}`);
      if (this.config.tenantId?.trim()) {
        url.searchParams.set("tenantId", this.config.tenantId.trim());
      }
      if (options?.eventTypes?.length) {
        url.searchParams.set("eventTypes", options.eventTypes.join(","));
      }
      if (options?.filter) {
        for (const [key, value] of Object.entries(options.filter)) {
          url.searchParams.set(`filter_${key}`, value);
        }
      }
      return url.toString();
    };

    const connect = async () => {
      if (closed) return;

      abortController = new AbortController();
      const url = buildSseUrl();
      const headers: Record<string, string> = {
        accept: "text/event-stream",
        ...(this.config.bearerToken ? { authorization: `Bearer ${this.config.bearerToken}` } : {}),
      };

      try {
        const response = await fetch(url, {
          method: "GET",
          headers,
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("SSE response body is not readable");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ") && !closed) {
              try {
                const event = JSON.parse(line.slice(6)) as TEvent;
                await callback(event);
              } catch {
                // Skip malformed event data
              }
            }
          }
        }
      } catch (error) {
        if (!closed && !(error instanceof Error && error.name === "AbortError")) {
          // Reconnect on error after delay
          setTimeout(connect, 1000);
        }
      }
    };

    // Start connection
    connect();

    return {
      unsubscribe() {
        closed = true;
        abortController?.abort();
      },
      get closed() {
        return closed;
      },
    };
  }

  private async request<T>(request: ApiRequestSpec, attempt = 0): Promise<ApiResponse<T>> {
    const url = buildApiUrl(this.config, request);
    const headers = buildAuthHeaders(this.config);

    if (request.body) {
      headers["content-type"] = "application/json";
    }

    try {
      const fetchOptions: RequestInit = {
        method: request.method ?? "GET",
        headers,
      };
      if (request.body !== undefined) {
        fetchOptions.body = JSON.stringify(request.body);
      }
      if (this.config.timeoutMs !== undefined) {
        fetchOptions.signal = AbortSignal.timeout(this.config.timeoutMs);
      }

      const response = await fetch(url, fetchOptions);

      if (!response.ok && attempt < this.retryConfig.maxRetries) {
        const retryAfter = Math.min(
          this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxBackoffMs,
        );
        await delay(retryAfter);
        return this.request<T>(request, attempt + 1);
      }

      const data = await response.json() as T;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        data,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      if (attempt < this.retryConfig.maxRetries) {
        const retryAfter = Math.min(
          this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
          this.retryConfig.maxBackoffMs,
        );
        await delay(retryAfter);
        return this.request<T>(request, attempt + 1);
      }
      throw error;
    }
  }
}

/**
 * Create a retryable API client with configuration.
 */
export function createApiClient(config: ApiClientConfig): RetryableApiClient {
  if (!config.baseUrl?.trim()) {
    throw new ValidationError("client_sdk.missing_base_url", "API client requires baseUrl.");
  }
  if (!config.apiVersion?.trim()) {
    throw new ValidationError("client_sdk.missing_api_version", "API client requires apiVersion.");
  }
  return new RetryableApiClient(config);
}

/**
 * Parse cursor pagination parameters.
 */
export function parseCursor(cursor: string | null | undefined): PaginationSpec | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    return decoded as PaginationSpec;
  } catch {
    return undefined;
  }
}

/**
 * Encode cursor pagination parameters.
 */
export function encodeCursor(pagination: PaginationSpec): string {
  return Buffer.from(JSON.stringify(pagination)).toString("base64");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
