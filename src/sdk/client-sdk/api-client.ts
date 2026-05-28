/**
 * @fileoverview Client SDK - Extended API Client
 *
 * Implements §22.1 Client SDK: API client with retry, pagination, and error handling.
 * R8-19 FIX: ContractEnvelope wrapper for inter-plane messages.
 */

import { ValidationError, NetworkError, AuthError, BusinessError, AppError } from "../../platform/contracts/errors.js";
import {
  type ContractEnvelope,
  createContractEnvelope as createExecutableContractEnvelope,
  signContractEnvelope,
  verifyContractEnvelopeSignature,
  type ContractEnvelopeVerificationResult,
} from "../../platform/contracts/executable-contracts/index.js";
import { nowIso, newId } from "../../platform/contracts/types/ids.js";
import type {
  ApiClientConfig,
  ApiRequestOptions,
  ApiRequestSpec,
  ApiResponse,
  PaginatedResponse,
  PaginationSpec,
  RetryConfig,
  VersionHandshakeResult,
} from "./api-client-types.js";
export type {
  ApiClientConfig,
  ApiRequestOptions,
  ApiRequestSpec,
  ApiResponse,
  PaginatedResponse,
  PaginationSpec,
  RetryConfig,
  VersionHandshakeResult,
} from "./api-client-types.js";

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  backoffMs: 100,
  backoffMultiplier: 2,
  maxBackoffMs: 1000,
};

export function parseRetryAfterDelayMs(retryAfterHeader: string | null, nowMs = Date.now()): number | null {
  if (retryAfterHeader == null) {
    return null;
  }
  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }
  const retryAtMs = Date.parse(retryAfterHeader);
  if (!Number.isFinite(retryAtMs)) {
    return null;
  }
  return Math.max(0, retryAtMs - nowMs);
}

function normalizeApiVersionSegment(apiVersion: string): string {
  const normalized = apiVersion.replace(/^\/+|\/+$/g, "");
  return normalized.startsWith("api/") ? normalized : `api/${normalized}`;
}

/**
 * Build a versioned API URL with query parameters and tenant context.
 */
export function buildApiUrl(config: ApiClientConfig, request: ApiRequestSpec): string {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const apiVersion = normalizeApiVersionSegment(config.apiVersion);
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
   * Initialize the API client with optional version handshake.
   * If performVersionHandshakeOnInit is true, performs version negotiation with server.
   */
  async initialize(): Promise<void> {
    if (this.config.performVersionHandshakeOnInit) {
      await this.fetchVersionCompatibility("/version");
    }
  }

  /**
   * Perform version handshake with the server to validate compatibility.
   * Sends version headers and checks server response for acceptance or rejection.
   * Throws ApiError with CONTRACT category if versions are incompatible (426 status).
   */
  async performVersionHandshake(): Promise<VersionHandshakeResult> {
    return this.fetchVersionCompatibility("/handshake");
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
  async post<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>({
      path,
      method: "POST",
      body,
      ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    });
  }

  /**
   * Make a PUT request with automatic retry.
   */
  async put<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>({
      path,
      method: "PUT",
      body,
      ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    });
  }

  async patch<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>({
      path,
      method: "PATCH",
      body,
      ...(options?.idempotencyKey !== undefined ? { idempotencyKey: options.idempotencyKey } : {}),
    });
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
    // R31-37 FIX: Check if parseInt result is NaN
    const rawTotalCount = totalCountHeader !== undefined ? parseInt(totalCountHeader, 10) : NaN;
    const totalCount = Number.isNaN(rawTotalCount) ? undefined : rawTotalCount;

    const result: PaginatedResponse<T> = {
      data: response.data,
      status: response.status,
      headers: response.headers,
      nextCursor: nextCursor as string | null,
    };
    return totalCount === undefined
      ? result
      : { ...result, totalCount };
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

  async createExecutionTicket<T>(body: unknown): Promise<ApiResponse<T>> {
    return this.post<T>("/execution-dispatch/tickets", body);
  }

  async dispatchExecution<T>(body: unknown): Promise<ApiResponse<T>> {
    return this.post<T>("/execution-dispatch/dispatch-next", body);
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
    return createExecutableContractEnvelope({
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
    let reconnectTimer: NodeJS.Timeout | null = null;
    let reconnectAttempt = 0;

    const buildSseUrl = () => {
      const url = new URL(`${this.config.baseUrl.replace(/\/+$/, "")}/${normalizeApiVersionSegment(this.config.apiVersion)}${path}`);
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
          throw new ValidationError("api_client.sse_body_unreadable", "SSE response body is not readable");
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
                reconnectAttempt = 0;
              } catch (error) {
                if (error instanceof SyntaxError) {
                  await callback({
                    errorCode: "client_sdk.sse_invalid_event_payload",
                    rawPayload: line.slice(6),
                  } as TEvent);
                  continue;
                }
                throw error;
              }
            }
          }
        }
      } catch (error) {
        if (!closed && !(error instanceof Error && error.name === "AbortError")) {
          reconnectAttempt += 1;
          const retryAfter = Math.min(1000 * (2 ** Math.min(reconnectAttempt - 1, 4)), 10000);
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            void connect();
          }, retryAfter);
          reconnectTimer.unref?.();
        }
      }
    };

    // Start connection
    void connect();

    return {
      unsubscribe() {
        closed = true;
        if (reconnectTimer != null) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        abortController?.abort();
      },
      get closed() {
        return closed;
      },
    };
  }

  /**
   * Map of HTTP methods that should NOT be retried automatically.
   * Only GET requests are retried on 5xx errors.
   * POST/DELETE/PUT/PATCH are not retried to prevent duplicate side effects.
   */
  private static readonly NON_IDEMPOTENT_METHODS = new Set(["POST", "DELETE"]);

  /**
   * R8-19 FIX: Wraps request payload in ContractEnvelope per five-plane boundary contract §5.5.
   * Envelope carries schemaVersion/commandId/correlationId/signature for inter-plane messages.
   */
  private wrapRequestBody<TPayload>(payload: TPayload, idempotencyKey?: string): ContractEnvelope<TPayload> {
    const metadata: Record<string, string> = {};
    const principalSubject = this.config.principal?.subject?.trim()
      || this.config.principal?.principalId?.trim()
      || this.config.principal?.userId?.trim();
    const principal = this.config.principal == null
      ? undefined
      : {
          ...(principalSubject ? { subject: principalSubject } : {}),
          ...(this.config.principal.tenantId ? { tenantId: this.config.principal.tenantId } : {}),
          ...(this.config.principal.roles?.length ? { roles: [...this.config.principal.roles] } : {}),
        };
    if (this.config.principal != null) {
      const p = this.config.principal as {
        subject?: string;
        principalId?: string;
        userId?: string;
        tenantId?: string;
        roles?: readonly string[];
        permissions?: readonly string[];
        displayName?: string;
      };
      if (principalSubject) metadata.principalSubject = principalSubject;
      if (p.tenantId) metadata.principalTenantId = p.tenantId;
      if (p.roles?.length) metadata.principalRoles = p.roles.join(",");
      if (p.permissions?.length) metadata.principalPermissions = p.permissions.join(",");
      if (p.displayName?.trim()) metadata.principalDisplayName = p.displayName.trim();
    }

    const envelope = createExecutableContractEnvelope({
      payload,
      schemaVersion: "v4.3",
      ttl: 30000,
      metadata,
      ...(idempotencyKey !== undefined
        ? { idempotencyKey }
        : this.config.idempotencyKey !== undefined
          ? { idempotencyKey: this.config.idempotencyKey }
          : {}),
    });
    return (
      principal == null
        ? envelope
        : {
            ...envelope,
            principal,
          }
    ) as ContractEnvelope<TPayload>;
  }

  /**
   * R8-19 FIX: Unwrap ContractEnvelope response to extract payload per §5.5 spec.
   * Responses from inter-plane calls carry the actual payload inside a ContractEnvelope.
   */
  private unwrapResponseEnvelope<TResponse>(data: unknown): TResponse {
    if (
      data != null &&
      typeof data === "object" &&
      "envelopeId" in data &&
      "schemaVersion" in data &&
      "payload" in data
    ) {
      // This is a ContractEnvelope response - extract the payload
      const envelope = data as ContractEnvelope<unknown>;
      return envelope.payload as TResponse;
    }
    // Not a ContractEnvelope - return as-is
    return data as TResponse;
  }

  /**
   * R2011 FIX: Convert ApiError to typed AppError for proper error classification.
   * HTTP errors are now thrown as typed exceptions (AuthError, NetworkError, BusinessError)
   * instead of being silently swallowed or returned as plain ApiError.
   */
  private wrapApiError(error: ApiError): AppError {
    switch (error.category) {
      case ApiErrorCategory.AUTH:
        return new AuthError("client_sdk.auth_failed", `Authentication/authorization failed: ${error.message}`, {
          statusCode: error.statusCode ?? 401,
          retryable: false,
        });
      case ApiErrorCategory.NETWORK:
        return new NetworkError("client_sdk.network_error", `Server error: ${error.message}`, {
          statusCode: error.statusCode ?? 503,
          retryable: error.isRetryable,
        });
      case ApiErrorCategory.BUSINESS:
        return new BusinessError("client_sdk.business_error", `Request failed with status ${error.statusCode ?? 400}: ${error.message}`, {
          statusCode: error.statusCode ?? 400,
          retryable: false,
        });
      case ApiErrorCategory.VALIDATION:
      case ApiErrorCategory.CONTRACT:
        return new ValidationError("client_sdk.contract_violation", `Request failed with status ${error.statusCode ?? 400}: ${error.message}`, {
          statusCode: error.statusCode ?? 400,
          retryable: false,
        });
      default:
        return new NetworkError("client_sdk.unknown_error", error.message, {
          statusCode: error.statusCode ?? 500,
          retryable: false,
        });
    }
  }

  private async fetchVersionCompatibility(path: string): Promise<VersionHandshakeResult> {
    const { response, body, headers } = await fetchVersionInfo(this.config, path);
    const warnings: string[] = [];
    const compatibilityStatus = headers["x-sdk-compatibility"];
    if (compatibilityStatus?.includes("warning")) {
      const warningHeader = headers["x-sdk-warnings"] ?? "";
      warnings.push(...warningHeader.split(",").map((warning) => warning.trim()).filter((warning) => warning.length > 0));
    }

    const platformVersion =
      typeof body.platformVersion === "string"
        ? body.platformVersion
        : headers["x-platform-version"];
    const contractVersion =
      typeof body.contractVersion === "string"
        ? body.contractVersion
        : headers["x-contract-version"];
    const minClientVersion =
      typeof body.minClientVersion === "string"
        ? body.minClientVersion
        : headers["x-min-client-version"];

    let accepted = response.ok;
    let reasonCode = "unknown";
    if (response.status === 426) {
      accepted = false;
      reasonCode = "sdk.upgrade_required";
    } else if (response.status === 200) {
      accepted = true;
      reasonCode = "sdk.accepted";
    }

    if (!accepted) {
      throw new ApiError(
        `Version handshake rejected: ${reasonCode}. Server requires upgrade.`,
        ApiErrorCategory.CONTRACT,
        response.status,
        false,
      );
    }

    if (
      minClientVersion != null &&
      this.config.sdkVersion != null &&
      !versionsCompatible(this.config.sdkVersion, minClientVersion)
    ) {
      throw new ValidationError(
        "client_sdk.version_incompatible",
        `SDK version ${this.config.sdkVersion} is not compatible with minimum required version ${minClientVersion}.`,
        {
          statusCode: response.status,
          retryable: false,
        },
      );
    }

    return {
      accepted,
      statusCode: response.status,
      reasonCode,
      headers,
      warnings,
      ...(platformVersion != null ? { platformVersion } : {}),
      ...(contractVersion != null ? { contractVersion } : {}),
      ...(minClientVersion != null ? { minClientVersion } : {}),
    };
  }

  private async request<T>(request: ApiRequestSpec, attempt = 0): Promise<ApiResponse<T>> {
    const url = buildApiUrl(this.config, request);
    const headers = buildAuthHeaders(this.config);

    if (request.body) {
      headers["content-type"] = "application/json";
    }

    // R15-01 FIX: Only retry on retryable status codes (5xx errors) for idempotent methods
    // POST/PUT/PATCH/DELETE should not be retried as they may cause duplicate side effects
    const isIdempotent = !RetryableApiClient.NON_IDEMPOTENT_METHODS.has(request.method ?? "GET");

    // R8-19 FIX: Wrap request body in ContractEnvelope for inter-plane contract compliance
    let envelopeBody: unknown;
    if (request.body !== undefined) {
      envelopeBody = this.wrapRequestBody(request.body, request.idempotencyKey);
    }

    try {
      const fetchOptions: RequestInit = {
        method: request.method ?? "GET",
        headers,
      };
      if (envelopeBody !== undefined) {
        fetchOptions.body = JSON.stringify(envelopeBody);
      }
      if (this.config.timeoutMs !== undefined) {
        fetchOptions.signal = AbortSignal.timeout(this.config.timeoutMs);
      }

      const response = await fetch(url, fetchOptions);

      const retryableStatus = response.status === 429 || response.status >= 500;
      if (!response.ok && retryableStatus && isIdempotent && attempt < this.retryConfig.maxRetries) {
        const retryAfterDelayMs = parseRetryAfterDelayMs(response.headers.get("retry-after"));
        const retryAfter = retryAfterDelayMs != null
          ? Math.min(retryAfterDelayMs, this.retryConfig.maxBackoffMs)
          : Math.min(
            this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxBackoffMs,
          );
        await delay(retryAfter);
        return this.request<T>(request, attempt + 1);
      }

      // R31-36 FIX: Only parse as success if response.ok is true
      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const category = classifyApiError(response.status, errorText);
        const apiError = new ApiError(
          `API request failed with status ${response.status}: ${errorText}`,
          category,
          response.status,
          response.status >= 500 && isIdempotent,
        );
        // R2011 FIX: Throw typed AppError instead of plain ApiError
        throw this.wrapApiError(apiError);
      }

      const rawData = await response.json() as unknown;
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // R8-19 FIX: Unwrap ContractEnvelope response if present per §5.5 spec
      const data = this.unwrapResponseEnvelope<T>(rawData);

      return {
        data,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      // R2011 FIX: Convert caught ApiError to typed AppError before re-throwing
      if (error instanceof ApiError) {
        throw this.wrapApiError(error);
      }
      // R15-03 FIX: Network errors should also be retried only for idempotent methods
      if (isIdempotent && attempt < this.retryConfig.maxRetries && error instanceof Error) {
        // Check if it's a network error (not an HTTP status error that we already threw above)
        const isNetworkError = error instanceof ApiError
          ? error.category === ApiErrorCategory.NETWORK
          : (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("ECONNREFUSED"));
        if (isNetworkError) {
          const retryAfter = Math.min(
            this.retryConfig.backoffMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
            this.retryConfig.maxBackoffMs,
          );
          await delay(retryAfter);
          return this.request<T>(request, attempt + 1);
        }
      }
      throw error;
    }
  }
}

// R8-20 FIX: Event subscription/streaming API
/**
 * Event subscription callback type.
 */
export type EventSubscriptionCallback<TEvent> = (event: TEvent) => void | Promise<void>;

/**
 * R15-03 FIX: Error types per SDK contract §5 - distinguish network/auth/business errors
 */
export enum ApiErrorCategory {
  NETWORK = "network",
  AUTH = "auth",
  VALIDATION = "validation",
  BUSINESS = "business",
  CONTRACT = "contract",
}

export class ApiError extends Error {
  public readonly category: ApiErrorCategory;
  public readonly statusCode: number | null;
  public readonly isRetryable: boolean;

  constructor(message: string, category: ApiErrorCategory, statusCode: number | null = null, isRetryable = false) {
    super(message);
    this.name = "ApiError";
    this.category = category;
    this.statusCode = statusCode;
    this.isRetryable = isRetryable;
  }
}

export function classifyApiError(statusCode: number | null, message: string): ApiErrorCategory {
  if (statusCode === null) {
    // Network errors
    if (message.includes("fetch") || message.includes("network") || message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT")) {
      return ApiErrorCategory.NETWORK;
    }
    return ApiErrorCategory.NETWORK;
  }
  if (statusCode === 401 || statusCode === 403) {
    return ApiErrorCategory.AUTH;
  }
  if (statusCode === 400 || statusCode === 422) {
    return ApiErrorCategory.VALIDATION;
  }
  if (statusCode === 409 || statusCode === 412) {
    return ApiErrorCategory.BUSINESS;
  }
  if (statusCode >= 500) {
    return ApiErrorCategory.NETWORK;
  }
  // 4xx client errors - business logic errors
  return ApiErrorCategory.BUSINESS;
}

/**
 * Event subscription handle for unsubscribe.
 */
export interface EventSubscription<TEvent> {
  subscriptionId?: string;
  consumerId?: string;
  eventTypes?: readonly string[];
  active?: boolean;
  unsubscribe(): void;
  closed: boolean;
}

// R8-20 FIX: Event subscriber interface for run lifecycle events
export interface EventSubscriberBackend {
  publish(event: unknown): void;
  subscribe(consumerId: string, handler: (event: unknown) => void): void;
  unsubscribe(consumerId: string): void;
  pendingForConsumer(consumerId: string): Array<{ eventType: string; payloadJson: string }>;
  deliverPending(consumerId: string): Promise<number>;
}

export interface EventSubscriptionHandle {
  subscriptionId?: string;
  consumerId: string;
  eventTypes?: readonly string[];
  active: boolean;
  unsubscribe(): void;
}

/**
 * Creates an event subscriber for run lifecycle events.
 */
export function createEventSubscriber(backend: EventSubscriberBackend) {
  return {
    subscribe(
      consumerId: string,
      eventTypes: readonly string[],
      handler: (event: unknown) => void,
    ): EventSubscriptionHandle {
      let active = true;
      const eventTypeSet = new Set(eventTypes);
      const wrappedHandler = (event: unknown) => {
        if (!active || !isPendingEvent(event) || !eventTypeSet.has(event.eventType)) {
          return;
        }
        handler(parseEventPayload(event.payloadJson));
      };
      backend.subscribe(consumerId, wrappedHandler);
      return {
        subscriptionId: `sub:${consumerId}:${Date.now()}`,
        consumerId,
        eventTypes,
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          backend.unsubscribe(consumerId);
        },
      };
    },
    unsubscribe(consumerId: string): void {
      backend.unsubscribe(consumerId);
    },
    getPendingEvents(consumerId: string): Array<{ eventType: string; payloadJson: string; payload: unknown }> {
      return backend.pendingForConsumer(consumerId).map((event) => ({
        ...event,
        payload: parseEventPayload(event.payloadJson),
      }));
    },
    deliverPending(consumerId: string): Promise<number> {
      return backend.deliverPending(consumerId);
    },
    pendingForConsumer(consumerId: string): Array<{ eventType: string; payloadJson: string }> {
      return backend.pendingForConsumer(consumerId);
    },
    subscribeToRunLifecycle(
      consumerId: string,
      runId: string,
      handler: (event: unknown) => void,
    ): EventSubscriptionHandle {
      let active = true;
      const wrappedHandler = (event: unknown) => {
        if (!active || !isPendingEvent(event)) {
          return;
        }
        const parsed = parseEventPayload(event.payloadJson);
        if (hasRunId(parsed, runId)) {
          handler(parsed);
        }
      };
      backend.subscribe(consumerId, wrappedHandler);
      return {
        subscriptionId: `sub:run:${consumerId}:${runId}:${Date.now()}`,
        consumerId,
        eventTypes: [
          "platform.harness_run.status_changed",
          "platform.node_run.status_changed",
          "platform.side_effect.status_changed",
        ],
        get active() {
          return active;
        },
        unsubscribe() {
          active = false;
          backend.unsubscribe(consumerId);
        },
      };
    },
  };
}

function isPendingEvent(event: unknown): event is { eventType: string; payloadJson: string } {
  return event != null
    && typeof event === "object"
    && typeof (event as { eventType?: unknown }).eventType === "string"
    && typeof (event as { payloadJson?: unknown }).payloadJson === "string";
}

function parseEventPayload(payloadJson: string): unknown {
  try {
    return JSON.parse(payloadJson) as unknown;
  } catch (error) {
    return {
      errorCode: "client_sdk.event_payload_invalid",
      message: error instanceof Error ? error.message : String(error),
      rawPayload: payloadJson,
    };
  }
}

function hasRunId(payload: unknown, runId: string): boolean {
  return payload != null
    && typeof payload === "object"
    && (payload as { runId?: unknown }).runId === runId;
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
  if (!(config.principal?.subject?.trim() || config.principal?.principalId?.trim() || config.principal?.userId?.trim())) {
    throw new ValidationError("client_sdk.missing_principal", "API client requires principal.");
  }
  return new RetryableApiClient(config);
}

export function createContractEnvelope<TPayload>(input: {
  payload: TPayload;
  principal?: {
    principalId?: string;
    subject?: string;
    tenantId?: string;
    roles?: readonly string[];
  };
  envelopeId?: string;
  schemaVersion?: string;
  commandId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  timestamp?: string;
  signature?: string | null;
  ttl?: number | null;
  metadata?: Readonly<Record<string, string>>;
}): ContractEnvelope<TPayload> {
  return {
    ...createExecutableContractEnvelope(input),
    ...(input.principal == null ? {} : { principal: input.principal }),
  } as ContractEnvelope<TPayload>;
}

export function wrapInContractEnvelope<TPayload>(
  payload: TPayload,
  principal?: Parameters<typeof createContractEnvelope<TPayload>>[0]["principal"],
  options: Omit<Parameters<typeof createContractEnvelope<TPayload>>[0], "payload" | "principal"> = {},
): ContractEnvelope<TPayload> {
  return createContractEnvelope({ payload, ...(principal == null ? {} : { principal }), ...options });
}

export function unwrapContractEnvelope<TPayload>(envelope: ContractEnvelope<TPayload>): TPayload {
  return envelope.payload;
}

/**
 * Parse cursor pagination parameters.
 */
export function parseCursor(cursor: string | null | undefined): PaginationSpec | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    if (decoded == null || typeof decoded !== "object" || Array.isArray(decoded)) {
      return undefined;
    }
    const record = decoded as Record<string, unknown>;
    const allowedKeys = new Set(["cursor", "limit"]);
    for (const key of Object.keys(record)) {
      if (!allowedKeys.has(key)) {
        return undefined;
      }
    }
    if (record.cursor !== undefined && typeof record.cursor !== "string") {
      return undefined;
    }
    if (record.limit !== undefined && (!Number.isInteger(record.limit) || (record.limit as number) < 0)) {
      return undefined;
    }
    return {
      ...(typeof record.cursor === "string" ? { cursor: record.cursor } : {}),
      ...(typeof record.limit === "number" ? { limit: record.limit } : {}),
    };
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof TypeError) {
      return undefined;
    }
    return undefined;
  }
}

function normalizeVersionPart(version: string): number[] {
  return version
    .replace(/^[^\d]*/, "")
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function versionsCompatible(clientVersion: string, minimumVersion: string): boolean {
  const clientParts = normalizeVersionPart(clientVersion);
  const minimumParts = normalizeVersionPart(minimumVersion);
  const maxLength = Math.max(clientParts.length, minimumParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const clientPart = clientParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (clientPart > minimumPart) {
      return true;
    }
    if (clientPart < minimumPart) {
      return false;
    }
  }
  return true;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }
  const parsed = await response.json().catch(() => ({}));
  return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

declare module "../../platform/contracts/executable-contracts/index.js" {
  interface ContractEnvelope<TPayload = unknown> {
    readonly principal?: {
      readonly subject?: string;
      readonly tenantId?: string;
      readonly roles?: readonly string[];
    };
  }
}

async function fetchVersionInfo(
  config: ApiClientConfig,
  path: string,
): Promise<{
  response: Response;
  body: Record<string, unknown>;
  headers: Record<string, string>;
}> {
  const url = buildApiUrl(config, { path, method: "GET" });
  const headers = buildAuthHeaders(config);
  headers.accept = "application/json";
  const response = await fetch(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(config.timeoutMs ?? 10000),
  });
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  const body = await parseJsonResponse(response);
  return { response, body, headers: responseHeaders };
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
