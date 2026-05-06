/**
 * @fileoverview Client SDK - Extended API Client
 *
 * Implements §22.1 Client SDK: API client with retry, pagination, and error handling.
 * §5.2 requires all inter-plane messages with schemaVersion/commandId/correlationId/signature
 * wrapped in a ContractEnvelope.
 */

import {
  AuthError,
  NetworkError,
  BusinessError,
  ValidationError,
} from "../../platform/contracts/errors.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import type { PrincipalRef } from "../../platform/contracts/executable-contracts/index.js";

// §5.2 ContractEnvelope - required wrapper for all inter-plane messages
export interface ContractEnvelope<TPayload = unknown> {
  readonly envelopeId: string;
  readonly schemaVersion: string;
  readonly commandId: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly signature: string | null;
  readonly principal: PrincipalRef;
  readonly timestamp: string;
  readonly payload: TPayload;
  readonly metadata: Readonly<Record<string, string>>;
}

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
  principal: PrincipalRef;
  /**
   * Default idempotency key for all requests made by this client.
   * Can be overridden per-request via ApiRequestSpec.idempotencyKey.
   * Used to ensure safe retries of mutating operations.
   */
  idempotencyKey?: string;
  /**
   * If true, perform version handshake with platform on client creation.
   * Validates client/platform version compatibility before issuing any requests.
   * Throws if versions are incompatible.
   */
  performVersionHandshakeOnInit?: boolean;
}

export interface ApiRequestSpec {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  /**
   * Idempotency key for this request.
   * If provided, enables safe retries of mutating operations.
   * The server will deduplicate requests with the same idempotency key.
   */
  idempotencyKey?: string;
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
    "X-Platform-Version": config.platformVersion ?? "v4.3",
    "X-SDK-Version": config.sdkVersion ?? "1.0.0",
    "X-Contract-Version": config.contractVersion ?? "v4.3",
  };
}

/**
 * Retry client with exponential backoff for resilient API calls.
 * Wraps all API calls in ContractEnvelope per §5.2.
 */
export class RetryableApiClient {
  private readonly config: ApiClientConfig;
  private readonly retryConfig: RetryConfig;

  constructor(config: ApiClientConfig, retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG) {
    // Ensure version headers are always set per §22.2 version handshake requirement
    this.config = {
      ...config,
      platformVersion: config.platformVersion ?? "v4.3",
      sdkVersion: config.sdkVersion ?? "1.0.0",
      contractVersion: config.contractVersion ?? "v4.3",
    };
    this.retryConfig = retryConfig;
  }

  /**
   * Initialize the client and optionally perform version handshake.
   * If performVersionHandshakeOnInit is set, validates client/platform compatibility.
   * Throws ValidationError if versions are incompatible.
   */
  async initialize(): Promise<void> {
    if (this.config.performVersionHandshakeOnInit) {
      await this.performVersionHandshake();
    }
  }

  /**
   * Perform version handshake with the platform.
   * Validates that client and platform versions are compatible.
   * Returns the platform's accepted version info or throws if incompatible.
   */
  async performVersionHandshake(): Promise<{
    platformVersion: string;
    contractVersion: string;
    minClientVersion: string;
  }> {
    const response = await this.get<{
      platformVersion: string;
      contractVersion: string;
      minClientVersion: string;
    }>("/version");

    const clientVersion = this.config.sdkVersion ?? "1.0.0";
    const minVersion = response.data.minClientVersion;

    if (!this.versionsCompatible(clientVersion, minVersion)) {
      throw new ValidationError(
        "client_sdk.version_incompatible",
        `Client version ${clientVersion} is not compatible with platform minimum version ${minVersion}`,
        { details: { clientVersion, minVersion, platformVersion: response.data.platformVersion } },
      );
    }

    return {
      platformVersion: response.data.platformVersion,
      contractVersion: response.data.contractVersion,
      minClientVersion: response.data.minClientVersion,
    };
  }

  /**
   * Check if client version satisfies minimum required version.
   */
  private versionsCompatible(clientVersion: string, minVersion: string): boolean {
    const clientParts = clientVersion.split(".").map(Number);
    const minParts = minVersion.split(".").map(Number);

    for (let i = 0; i < Math.max(clientParts.length, minParts.length); i++) {
      const clientPart = clientParts[i] ?? 0;
      const minPart = minParts[i] ?? 0;
      if (clientPart < minPart) return false;
      if (clientPart > minPart) return true;
    }
    return true;
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
    const parsedTotal = totalCountHeader !== undefined ? parseInt(totalCountHeader, 10) : NaN;
    const totalCount = Number.isNaN(parsedTotal) ? undefined : parsedTotal;

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

  private async request<T>(request: ApiRequestSpec, attempt = 0): Promise<ApiResponse<T>> {
    const url = buildApiUrl(this.config, request);
    const headers = buildAuthHeaders(this.config);

    // §22.2: Use request-level idempotency key if provided, otherwise fall back to client-level key
    const idempotencyKey = request.idempotencyKey ?? this.config.idempotencyKey;

    let body = request.body;
    // §5.2 ContractEnvelope - ALL inter-plane messages must be wrapped per spec.
    // Even requests without a body (GET/DELETE) must use ContractEnvelope for:
    // - schemaVersion/correlationId/commandId tracking
    // - signature/principal for authenticity
    // - idempotencyKey for deduplication
    const envelope = createContractEnvelope({
      payload: request.body ?? {},
      principal: this.config.principal,
      ...(idempotencyKey != null ? { idempotencyKey } : {}),
    });
    body = envelope;
    headers["content-type"] = "application/json";

    try {
      const fetchOptions: RequestInit = {
        method: request.method ?? "GET",
        headers,
      };
      if (body !== undefined) {
        fetchOptions.body = JSON.stringify(body);
      }
      if (this.config.timeoutMs !== undefined) {
        fetchOptions.signal = AbortSignal.timeout(this.config.timeoutMs);
      }

      const response = await fetch(url, fetchOptions);

      // §22: Only retry 5xx/429 on idempotent requests, not 4xx client errors.
      // POST/PUT/DELETE/OPTIONS/PATCH are never idempotent and MUST NOT be retried
      // to prevent duplicate side effects. 4xx errors indicate client mistakes
      // (malformed request, auth failure, etc.) that retrying won't fix.
      // R15-01: GET retries unconditionally; PUT/DELETE only retry if idempotency key present.
      const method: string = request.method ?? "GET";
      const isPostLike = method === "POST" || method === "PATCH" || method === "OPTIONS";
      const isPutDelete = method === "PUT" || method === "DELETE";
      const hasIdempotencyKey = idempotencyKey != null;
      const canRetry = method === "GET" || (isPutDelete && hasIdempotencyKey);
      if (canRetry && response.status >= 500 && attempt < this.retryConfig.maxRetries) {
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

      // §5: Classify errors by HTTP status code and throw TYPED errors per spec.
      // Root cause: Previously HTTP errors could be swallowed if response.json() threw
      // before we checked response.ok. Now we parse response body safely and ensure
      // ALL non-2xx responses throw typed errors (AuthError/BusinessError/NetworkError).
      if (!response.ok) {
        const errorInfo = extractErrorInfo(data);
        if (response.status === 401 || response.status === 403) {
          throw new AuthError("client_sdk.auth_failed", `Authentication/authorization failed: ${response.status}`, {
            statusCode: response.status,
            details: errorInfo,
            source: "gateway",
          });
        }
        if (response.status >= 400 && response.status < 500) {
          // Business logic errors (validation, business rule violations)
          throw new BusinessError("client_sdk.business_error", `Request failed with status ${response.status}: ${response.statusText}`, {
            statusCode: response.status,
            details: errorInfo,
            source: "runtime",
          });
        }
        // Server errors - potentially transient but not retryable at this layer
        throw new NetworkError("client_sdk.server_error", `Server error: ${response.status} ${response.statusText}`, {
          statusCode: response.status,
          details: errorInfo,
          source: "gateway",
        });
      }

      return {
        data,
        status: response.status,
        headers: responseHeaders,
      };
    } catch (error) {
      if (
        error instanceof AuthError ||
        error instanceof BusinessError ||
        error instanceof ValidationError ||
        error instanceof NetworkError
      ) {
        throw error;
      }
      // §22: Network errors (fetch throws) - only retry for truly idempotent methods.
      // POST/PUT/DELETE/PATCH/OPTIONS network errors may have caused partial side effects
      // and MUST NOT be retried blindly. Only GET/HEAD can be safely retried on network errors.
      // R15-01: GET retries unconditionally; PUT/DELETE only retry if idempotency key present.
      const method: string = request.method ?? "GET";
      const isPostLike = method === "POST" || method === "PATCH" || method === "OPTIONS";
      const isPutDelete = method === "PUT" || method === "DELETE";
      const hasIdempotencyKey = idempotencyKey != null;
      const canRetry = method === "GET" || (isPutDelete && hasIdempotencyKey);
      if (canRetry && attempt < this.retryConfig.maxRetries) {
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
 * Extract error information from API response body for structured error handling.
 * SDK contract §5 requires error classification (network/auth/business).
 */
function extractErrorInfo(data: unknown): Record<string, unknown> | null {
  if (data == null) {
    return null;
  }
  if (typeof data === "object") {
    // Prefer structured error fields if available
    const obj = data as Record<string, unknown>;
    if (obj.code || obj.error || obj.message) {
      return {
        code: obj.code ?? obj.error,
        message: obj.message ?? obj.error,
        details: obj.details ?? obj.internalDetails ?? null,
      };
    }
    return obj;
  }
  return null;
}

/**
 * Create a retryable API client with configuration.
 * Principal is required for ContractEnvelope per §5.2.
 *
 * Root cause: Previously performVersionHandshakeOnInit defaulted to false/unset,
 * so version handshake never ran. Per spec, version handshake is MANDATORY.
 * Now defaults to true to ensure compatibility validation before first request.
 */
export function createApiClient(config: ApiClientConfig): RetryableApiClient {
  if (!config.baseUrl?.trim()) {
    throw new ValidationError("client_sdk.missing_base_url", "API client requires baseUrl.");
  }
  if (!config.apiVersion?.trim()) {
    throw new ValidationError("client_sdk.missing_api_version", "API client requires apiVersion.");
  }
  if (!config.principal) {
    throw new ValidationError("client_sdk.missing_principal", "API client requires principal for ContractEnvelope.");
  }
  // Ensure version handshake is enabled by default per §22.2 spec requirement
  if (config.performVersionHandshakeOnInit === undefined) {
    (config as { performVersionHandshakeOnInit: boolean }).performVersionHandshakeOnInit = true;
  }
  return new RetryableApiClient(config);
}

/**
 * Parse cursor pagination parameters with schema validation.
 * Validates that the cursor contains only expected fields to prevent injection.
 */
export function parseCursor(cursor: string | null | undefined): PaginationSpec | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64").toString("utf-8"));
    // Validate cursor structure to prevent injection of arbitrary properties
    if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
      return undefined;
    }
    const { cursor: _cursor, limit: _limit, ...extra } = decoded as Record<string, unknown>;
    // Reject cursors with unexpected properties to prevent injection
    if (Object.keys(extra).length > 0) {
      return undefined;
    }
    // Validate types of known fields
    if (_cursor !== undefined && typeof _cursor !== "string") {
      return undefined;
    }
    if (_limit !== undefined && (typeof _limit !== "number" || !Number.isInteger(_limit) || _limit < 1)) {
      return undefined;
    }
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

// §5.2 ContractEnvelope factory and utilities

/**
 * Supported contract envelope content types.
 */
const CONTRACT_ENVELOPE_CONTENT_TYPE = "application/json; envelope-type=contract";
const APPLICATION_JSON_CONTENT_TYPE = "application/json";

/**
 * Check if a content-type header indicates a ContractEnvelope response.
 */
function isContractEnvelopeContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.startsWith("application/json") && contentType.includes("envelope-type=contract");
}

/**
 * Verify and unwrap an incoming ContractEnvelope.
 * Validates required fields and returns the inner payload.
 * Throws ValidationError if envelope is malformed.
 */
function verifyAndUnwrapEnvelope<TPayload>(envelope: unknown, expectedSchemaVersion?: string): TPayload {
  if (envelope == null || typeof envelope !== "object") {
    throw new ValidationError("client_sdk.invalid_envelope", "ContractEnvelope must be a non-null object.");
  }

  const obj = envelope as Record<string, unknown>;

  // Verify required envelope fields per §5.2
  if (typeof obj.envelopeId !== "string" || !obj.envelopeId.trim()) {
    throw new ValidationError("client_sdk.missing_envelope_id", "ContractEnvelope missing or invalid envelopeId.");
  }
  if (typeof obj.schemaVersion !== "string" || !obj.schemaVersion.trim()) {
    throw new ValidationError("client_sdk.missing_schema_version", "ContractEnvelope missing or invalid schemaVersion.");
  }
  if (typeof obj.commandId !== "string" || !obj.commandId.trim()) {
    throw new ValidationError("client_sdk.missing_command_id", "ContractEnvelope missing or invalid commandId.");
  }
  if (typeof obj.idempotencyKey !== "string" || !obj.idempotencyKey.trim()) {
    throw new ValidationError("client_sdk.missing_idempotency_key", "ContractEnvelope missing or invalid idempotencyKey.");
  }
  if (typeof obj.correlationId !== "string" || !obj.correlationId.trim()) {
    throw new ValidationError("client_sdk.missing_correlation_id", "ContractEnvelope missing or invalid correlationId.");
  }
  if (typeof obj.timestamp !== "string" || !obj.timestamp.trim()) {
    throw new ValidationError("client_sdk.missing_timestamp", "ContractEnvelope missing or invalid timestamp.");
  }
  if (!obj.principal || typeof obj.principal !== "object") {
    throw new ValidationError("client_sdk.missing_principal", "ContractEnvelope missing or invalid principal.");
  }

  // Validate schema version if expected version provided
  if (expectedSchemaVersion && obj.schemaVersion !== expectedSchemaVersion) {
    throw new ValidationError("client_sdk.schema_version_mismatch", `ContractEnvelope schemaVersion mismatch: expected ${expectedSchemaVersion}, got ${obj.schemaVersion}`);
  }

  // The payload field contains the actual response data
  if (!Object.prototype.hasOwnProperty.call(obj, "payload")) {
    throw new ValidationError("client_sdk.missing_payload", "ContractEnvelope missing payload field.");
  }

  return obj.payload as TPayload;
}

/**
 * Create a ContractEnvelope wrapping a payload with required metadata.
 * All inter-plane messages must use this wrapper per §5.2.
 */
export function createContractEnvelope<TPayload>(input: {
  payload: TPayload;
  principal: PrincipalRef;
  schemaVersion?: string;
  commandId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  signature?: string | null;
  metadata?: Readonly<Record<string, string>>;
}): ContractEnvelope<TPayload> {
  return {
    envelopeId: newId("env"),
    schemaVersion: input.schemaVersion ?? "v4.3",
    commandId: input.commandId ?? newId("cmd"),
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    correlationId: input.correlationId ?? newId("corr"),
    signature: input.signature ?? null,
    principal: input.principal,
    timestamp: nowIso(),
    payload: input.payload,
    metadata: input.metadata ?? {},
  };
}

/**
 * Wrap a payload in a ContractEnvelope with system-generated metadata.
 */
export function wrapInContractEnvelope<TPayload>(
  payload: TPayload,
  principal: PrincipalRef,
  options?: {
    schemaVersion?: string;
    commandId?: string;
    idempotencyKey?: string;
    correlationId?: string;
    signature?: string | null;
    metadata?: Readonly<Record<string, string>>;
  },
): ContractEnvelope<TPayload> {
  return createContractEnvelope({
    payload,
    principal,
    ...options,
  });
}

/**
 * Unwrap a ContractEnvelope to access its payload.
 */
export function unwrapContractEnvelope<TPayload>(
  envelope: ContractEnvelope<TPayload>,
): TPayload {
  return envelope.payload;
}

// §6/§28 Typed event subscription API for client SDK

/**
 * WebSocket-based EventSubscriptionClient for subscribing to platform events.
 * Connects to /ws/v1/stream for real-time event delivery with automatic reconnection.
 */
export interface SubscriptionHandle {
  /** Unique subscription ID */
  readonly subscriptionId: string;
  /** Event types this subscription is subscribed to */
  readonly eventTypes: readonly string[];
  /** Close the subscription and release resources */
  close(): void;
}

/**
 * Event subscription options for EventSubscriptionClient.
 */
export interface EventSubscriptionClientOptions {
  /** WebSocket endpoint URL (e.g., wss://platform.example.com/ws/v1/stream) */
  webSocketUrl: string;
  /** Bearer token for authentication via Sec-WebSocket-Protocol header */
  bearerToken: string;
  /** Initial event types to subscribe to */
  eventTypes?: readonly string[];
  /** Reconnection delay in ms (default 3000) */
  reconnectDelayMs?: number;
  /** Maximum reconnection attempts (default 10) */
  maxReconnectAttempts?: number;
  /** Called when connection is established */
  onConnect?: () => void;
  /** Called when disconnected */
  onDisconnect?: () => void;
  /** Called on connection error */
  onError?: (error: Error) => void;
}

export class EventSubscriptionClient {
  private webSocket: WebSocket | null = null;
  private readonly options: Required<EventSubscriptionClientOptions>;
  private subscriptionCounter = 0;
  private subscriptions = new Map<string, {
    eventTypes: Set<string>;
    handler: (event: PlatformFactEvent) => void | Promise<void>;
  }>();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldReconnect = true;
  private isIntentionallyClosed = false;
  private messageQueue: string[] = [];

  constructor(options: EventSubscriptionClientOptions) {
    if (!options.webSocketUrl?.trim()) {
      throw new ValidationError("client_sdk.missing_websocket_url", "EventSubscriptionClient requires webSocketUrl.");
    }
    if (!options.bearerToken?.trim()) {
      throw new ValidationError("client_sdk.missing_bearer_token", "EventSubscriptionClient requires bearerToken.");
    }

    this.options = {
      webSocketUrl: options.webSocketUrl,
      bearerToken: options.bearerToken,
      eventTypes: options.eventTypes ?? [],
      reconnectDelayMs: options.reconnectDelayMs ?? 3000,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      onConnect: options.onConnect ?? (() => {}),
      onDisconnect: options.onDisconnect ?? (() => {}),
      onError: options.onError ?? (() => {}),
    };
  }

  /**
   * Connect to the WebSocket endpoint and optionally subscribe to event types.
   */
  async connect(): Promise<void> {
    return this.doConnect();
  }

  /**
   * Subscribe to events with the given handler.
   * @param eventTypes - Array of event type strings to subscribe to
   * @param handler - Callback function invoked when matching events arrive
   * @returns SubscriptionHandle for managing the subscription lifecycle
   */
  async subscribe(
    eventTypes: readonly string[],
    handler: (event: PlatformFactEvent) => void | Promise<void>,
  ): Promise<SubscriptionHandle> {
    const subscriptionId = `sub:${++this.subscriptionCounter}:${Date.now()}`;

    // Store subscription
    this.subscriptions.set(subscriptionId, {
      eventTypes: new Set(eventTypes),
      handler,
    });

    // If WebSocket is connected, send subscribe message
    if (this.webSocket?.readyState === 1) {
      for (const eventType of eventTypes) {
        const subscribeMsg = JSON.stringify({
          type: "subscribe",
          eventType,
          subscriptionId,
        });
        this.webSocket.send(subscribeMsg);
      }
    }

    return {
      subscriptionId,
      eventTypes,
      close: () => this.unsubscribe(subscriptionId),
    };
  }

  /**
   * Unsubscribe from events using the subscription handle.
   * @param handle - The SubscriptionHandle returned from subscribe()
   */
  async unsubscribe(handle: SubscriptionHandle | string): Promise<void> {
    const subscriptionId = typeof handle === "string" ? handle : handle.subscriptionId;
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Send unsubscribe messages if connected
    if (this.webSocket?.readyState === 1) {
      for (const eventType of subscription.eventTypes) {
        const unsubscribeMsg = JSON.stringify({
          type: "unsubscribe",
          eventType,
          subscriptionId,
        });
        this.webSocket.send(unsubscribeMsg);
      }
    }

    this.subscriptions.delete(subscriptionId);
  }

  /**
   * Disconnect and clean up all resources.
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;
    this.isIntentionallyClosed = true;
    this.clearReconnectTimer();
    this.closeWebSocket();
  }

  /**
   * Check if the client is currently connected.
   */
  isConnected(): boolean {
    return this.webSocket?.readyState === WebSocket.OPEN;
  }

  private doConnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Connect to WebSocket with bearer token via Sec-WebSocket-Protocol header
        // §11/R11-09: Token via header NOT URL query param to prevent exposure in logs
        this.webSocket = new WebSocket(
          this.options.webSocketUrl,
          this.options.bearerToken,
        );

        this.webSocket.onopen = () => {
          this.reconnectAttempts = 0;
          this.isIntentionallyClosed = false;
          this.options.onConnect();

          // Send initial subscriptions
          for (const [subId, subscription] of this.subscriptions) {
            for (const eventType of subscription.eventTypes) {
              const msg = JSON.stringify({
                type: "subscribe",
                eventType,
                subscriptionId: subId,
              });
              this.webSocket!.send(msg);
            }
          }

          // Flush queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift()!;
            this.webSocket!.send(msg);
          }

          resolve();
        };

        this.webSocket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.webSocket.onclose = (event) => {
          this.options.onDisconnect();
          this.handleClose(event);
        };

        this.webSocket.onerror = (event) => {
          const error = new Error(`WebSocket error: ${event.type}`);
          this.options.onError(error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as Record<string, unknown>;

      // Handle task_update messages
      if (message.type === "task_update") {
        const event = message.event as Record<string, unknown>;
        const eventCausationId = event.causationId as string | undefined;
        const eventCorrelationId = event.correlationId as string | undefined;

        // Build platform event object - only include optional properties when defined
        // This satisfies exactOptionalPropertyTypes: omit when undefined, include when set
        const platformEvent: PlatformFactEvent = {
          eventId: String(event.eventId ?? message.eventId ?? ""),
          runId: String(event.runId ?? message.runId ?? ""),
          eventType: String(event.eventType ?? message.eventType ?? ""),
          schemaVersion: Number(event.schemaVersion ?? 1),
          aggregateType: String(event.aggregateType ?? "task"),
          aggregateId: String(event.aggregateId ?? message.taskId ?? ""),
          aggregateSeq: Number(event.aggregateSeq ?? 0),
          tenantId: String(event.tenantId ?? ""),
          traceId: String(event.traceId ?? ""),
          payloadHash: String(event.payloadHash ?? ""),
          payload: event.payload ?? {},
          replayBehavior: (event.replayBehavior as "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden") ?? "replay_as_fact",
          sourceOfTruth: (event.sourceOfTruth as "platform" | "projection") ?? "platform",
          occurredAt: String(event.occurredAt ?? event.timestamp ?? new Date().toISOString()),
          ...(eventCausationId !== undefined && { causationId: eventCausationId }),
          ...(eventCorrelationId !== undefined && { correlationId: eventCorrelationId }),
        };

        // Dispatch to all matching subscriptions
        for (const [subId, subscription] of this.subscriptions) {
          if (subscription.eventTypes.has(platformEvent.eventType)) {
            try {
              const result = subscription.handler(platformEvent);
              if (result instanceof Promise) {
                result.catch((err) => {
                  console.error(`Subscription handler error for ${subId}:`, err);
                });
              }
            } catch (err) {
              console.error(`Subscription handler error for ${subId}:`, err);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleClose(event: { wasClean: boolean; code: number; reason: string }): void {
    if (this.isIntentionallyClosed) {
      return;
    }

    if (this.shouldReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.options.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
        30000,
      );

      this.reconnectTimer = setTimeout(() => {
        this.doConnect().catch((error) => {
          this.options.onError(error);
        });
      }, delay);
    }
  }

  private closeWebSocket(): void {
    if (this.webSocket) {
      // WebSocket.OPEN = 1, WebSocket.CONNECTING = 0
      if (this.webSocket.readyState === 1 || this.webSocket.readyState === 0) {
        this.webSocket.close(1000, "Client disconnect");
      }
      this.webSocket = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/**
 * Create a new EventSubscriptionClient with the given options.
 */
export function createEventSubscriptionClient(options: EventSubscriptionClientOptions): EventSubscriptionClient {
  return new EventSubscriptionClient(options);
}

/**
 * Event subscription options.
 */
export interface EventSubscriptionOptions {
  /** Consumer ID for this subscription */
  consumerId: string;
  /** Event types to subscribe to */
  eventTypes: readonly string[];
  /** Polling interval in ms (default 100) */
  pollIntervalMs?: number;
}

/**
 * Event subscription handle for managing subscription lifecycle.
 */
export interface EventSubscription {
  /** Unique subscription ID */
  readonly subscriptionId: string;
  /** Consumer ID used when creating this subscription */
  readonly consumerId: string;
  /** Event types this subscription is subscribed to */
  readonly eventTypes: readonly string[];
  /** Whether the subscription is currently active */
  readonly active: boolean;
  /** Unsubscribe and clean up resources */
  unsubscribe(): void;
}

/**
 * PlatformFactEvent - canonical platform fact event per §5.2
 */
export interface PlatformFactEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly runId: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq: number;
  readonly tenantId: string;
  readonly traceId: string;
  readonly causationId?: string;
  readonly correlationId?: string;
  readonly payloadHash: string;
  readonly payload: TPayload;
  readonly replayBehavior: "replay_as_fact" | "skip_side_effect" | "simulate" | "forbidden";
  readonly sourceOfTruth?: "platform" | "projection";
  readonly occurredAt: string;
}

/**
 * ProjectionUpdate - run lifecycle projection update per §6
 */
export interface ProjectionUpdate {
  readonly projectionId: string;
  readonly projectionType: string;
  readonly version: number;
  readonly timestamp: string;
  readonly sourceEvents: readonly string[];
  readonly patch: Readonly<Record<string, unknown>>;
  readonly metadata: {
    readonly rebuiltAt?: string | undefined;
    readonly triggeredBy: string;
    readonly idempotencyKey: string;
  };
}

/**
 * TypedEventSubscriber - provides typed event subscription API.
 * Used for subscribing to PlatformFactEvent/ProjectionUpdate/run lifecycle events per §6/§28.
 */
export interface TypedEventSubscriber {
  /**
   * Subscribe to specific event types with a handler.
   * @param consumerId - Unique consumer identifier
   * @param eventTypes - Array of event type strings to subscribe to
   * @param handler - Callback function for matching events
   * @returns Subscription handle for managing lifecycle
   */
  subscribe(
    consumerId: string,
    eventTypes: readonly string[],
    handler: (event: PlatformFactEvent | ProjectionUpdate) => void | Promise<void>,
  ): EventSubscription;

  /**
   * Subscribe to run lifecycle events (created/updated/completed/failed).
   * @param consumerId - Unique consumer identifier
   * @param runId - Harness run ID to track
   * @param handler - Callback for run lifecycle events
   * @returns Subscription handle
   */
  subscribeToRunLifecycle(
    consumerId: string,
    runId: string,
    handler: (event: PlatformFactEvent) => void | Promise<void>,
  ): EventSubscription;

  /**
   * Unsubscribe a consumer from all events.
   * @param consumerId - Consumer ID to unsubscribe
   */
  unsubscribe(consumerId: string): void;

  /**
   * Get pending events for a consumer.
   * @param consumerId - Consumer ID
   * @returns Array of pending events
   */
  getPendingEvents(consumerId: string): readonly (PlatformFactEvent | ProjectionUpdate)[];

  /**
   * Deliver pending events to a specific consumer.
   * @param consumerId - Consumer ID
   * @returns Number of events delivered
   */
  deliverPending(consumerId: string): Promise<number>;
}

/**
 * Create a typed event subscriber for the client SDK.
 * Note: Actual implementation requires a connection to the platform event bus.
 * This creates a local event bus adapter for client-side subscription management.
 */
export function createEventSubscriber(
  eventBus: {
    publish: (event: { eventType: string; payload: unknown }) => void;
    subscribe: (consumerId: string, handler: (event: { eventType: string; payloadJson: string }) => void) => void;
    unsubscribe: (consumerId: string) => void;
    pendingForConsumer: (consumerId: string) => Array<{ eventType: string; payloadJson: string }>;
    deliverPending: (consumerId: string) => Promise<number>;
  },
): TypedEventSubscriber {
  const subscriptions = new Map<string, ReturnType<typeof setTimeout>>();

  function parsePayload<T>(payloadJson: string): T {
    try {
      return JSON.parse(payloadJson) as T;
    } catch {
      return {} as T;
    }
  }

  return {
    subscribe(
      consumerId: string,
      eventTypes: readonly string[],
      handler: (event: PlatformFactEvent | ProjectionUpdate) => void | Promise<void>,
    ): EventSubscription {
      const accepted = new Set(eventTypes);
      eventBus.subscribe(consumerId, (event) => {
        if (accepted.has(event.eventType)) {
          const payload = parsePayload<PlatformFactEvent | ProjectionUpdate>(event.payloadJson);
          handler(payload);
        }
      });
      return {
        subscriptionId: `sub:${consumerId}:${Date.now()}`,
        consumerId,
        eventTypes,
        active: true,
        unsubscribe() {
          eventBus.unsubscribe(consumerId);
          const timer = subscriptions.get(consumerId);
          if (timer) {
            clearInterval(timer);
            subscriptions.delete(consumerId);
          }
        },
      };
    },

    subscribeToRunLifecycle(
      consumerId: string,
      runId: string,
      handler: (event: PlatformFactEvent) => void | Promise<void>,
    ): EventSubscription {
      const runLifecycleEvents = [
        "platform.harness_run.status_changed",
        "platform.node_run.status_changed",
        "platform.side_effect.status_changed",
        "platform.budget_ledger.status_changed",
        "platform.budget_reservation.status_changed",
      ];
      const accepted = new Set(runLifecycleEvents);
      eventBus.subscribe(consumerId, (event) => {
        if (accepted.has(event.eventType)) {
          const payload = parsePayload<PlatformFactEvent>(event.payloadJson);
          const runPayload = payload as unknown as { runId?: string };
          if (runPayload?.runId === runId) {
            handler(payload);
          }
        }
      });
      return {
        subscriptionId: `sub:run:${consumerId}:${runId}:${Date.now()}`,
        consumerId,
        eventTypes: runLifecycleEvents,
        active: true,
        unsubscribe() {
          eventBus.unsubscribe(consumerId);
          const timer = subscriptions.get(consumerId);
          if (timer) {
            clearInterval(timer);
            subscriptions.delete(consumerId);
          }
        },
      };
    },

    unsubscribe(consumerId: string): void {
      eventBus.unsubscribe(consumerId);
      const timer = subscriptions.get(consumerId);
      if (timer) {
        clearInterval(timer);
        subscriptions.delete(consumerId);
      }
    },

    getPendingEvents(consumerId: string): readonly (PlatformFactEvent | ProjectionUpdate)[] {
      return (eventBus.pendingForConsumer(consumerId).map((event) => ({
        ...event,
        payload: parsePayload<PlatformFactEvent["payload"]>(event.payloadJson),
      })) as unknown) as readonly (PlatformFactEvent | ProjectionUpdate)[];
    },

    async deliverPending(consumerId: string): Promise<number> {
      return eventBus.deliverPending(consumerId);
    },
  };
}
