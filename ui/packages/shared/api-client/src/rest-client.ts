import type {
  AgentDTO,
  AnalyticsMetricDTO,
  ApprovalDTO,
  CostReportDTO,
  DashboardSnapshotDTO,
  DomainConfigDTO,
  ExplanationDTO,
  FeatureFlagDTO,
  IncidentDTO,
  MarketplacePackDTO,
  ModelConfigDTO,
  QueueDTO,
  RoleDTO,
  SystemConfigDTO,
  TaskDTO,
  TenantDTO,
  UserDTO,
  UserPreferenceDTO,
  WebhookDTO,
  WorkerDTO,
  WorkflowRunStepDTO,
  WorkflowDTO,
} from "@aa/shared-types";
import { defaultMockApiShape, type MockApiShape } from "./mock-data.js";
import type { RestClientInterceptor, RestClientRequest, RestClientResponse } from "./interceptors.js";
import { generateStableId } from "./runtime-support.js";

export interface TransportResponse<T> {
  readonly status: number;
  readonly data: T;
}

export interface RestRequestOptions {
  readonly headers?: Headers;
}

export type RestTransport = <T>(request: RestClientRequest) => Promise<TransportResponse<T>>;

export interface RESTClient {
  get<T>(path: string, options?: RestRequestOptions): Promise<T>;
  post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T>;
  delete<T>(path: string, options?: RestRequestOptions): Promise<T>;
}

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly acceptVersion?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImplementation?: typeof fetch;
  readonly fallbackToMock?: boolean;
  readonly credentials?: RequestCredentials;
  readonly mode?: RequestMode;
  readonly timeoutMs?: number;
}

export const DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01";

export type RestHttpUiAction = "redirect_to_login" | "access_denied" | "backoff_and_retry" | "version_not_supported" | "none";
export type RestHttpErrorCategory = "network" | "auth" | "validation" | "business" | "contract";

export class RestHttpError extends Error {
  public readonly status: number;
  public readonly uiAction: RestHttpUiAction;
  public readonly retryAfterMs: number | null;
  public readonly category: RestHttpErrorCategory;
  public readonly statusCode: number;
  public readonly isRetryable: boolean;
  public readonly code: string | null;

  public constructor(
    status: number,
    retryAfterMs: number | null = null,
    details: { message?: string; code?: string | null } = {},
  ) {
    super(details.message ?? `rest.http_error:${status}`);
    this.status = status;
    this.statusCode = status;
    this.retryAfterMs = retryAfterMs;
    this.category = classifyRestHttpError(status);
    this.isRetryable = status === 429 || status >= 500;
    this.code = details.code ?? null;
    this.uiAction = status === 401
      ? "redirect_to_login"
      : status === 403
        ? "access_denied"
        : status === 406
          ? "version_not_supported"
        : status === 429
          ? "backoff_and_retry"
          : "none";
  }
}

export class MockTransport {
  public constructor(private readonly data: MockApiShape = defaultMockApiShape) {}

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const payload = this.resolve(request.path, request.body);
    return {
      status: this.resolveStatus(request.method),
      data: payload as T,
    };
  }

  private resolveStatus(method: RestClientRequest["method"]): number {
    if (method === "POST") {
      return 201;
    }
    if (method === "DELETE") {
      return 204;
    }
    return 200;
  }

  private resolve(path: string, body?: unknown):
    | DashboardSnapshotDTO
    | readonly TaskDTO[]
    | readonly WorkflowRunStepDTO[]
    | readonly WorkflowDTO[]
    | readonly ApprovalDTO[]
    | readonly IncidentDTO[]
    | readonly WorkerDTO[]
    | readonly QueueDTO[]
    | readonly AgentDTO[]
    | readonly AnalyticsMetricDTO[]
    | readonly CostReportDTO[]
    | readonly MarketplacePackDTO[]
    | readonly ExplanationDTO[]
    | readonly RoleDTO[]
    | readonly FeatureFlagDTO[]
    | readonly ModelConfigDTO[]
    | readonly DomainConfigDTO[]
    | readonly TenantDTO[]
    | readonly WebhookDTO[]
    | readonly UserDTO[]
    | SystemConfigDTO
    | UserPreferenceDTO
    | { ok: true; body?: unknown } {
    if (path.includes("/dashboard")) {
      return this.data.dashboard;
    }
    if (path.includes("/tasks")) {
      return this.data.tasks;
    }
    if (path.includes("/workflow-runs/")) {
      const workflowRunId = path.split("/workflow-runs/")[1]?.split("/")[0] ?? "";
      return this.data.workflowRunSteps[workflowRunId] ?? [];
    }
    if (path.includes("/workflows")) {
      return this.data.workflows;
    }
    if (path.includes("/approvals")) {
      return this.data.approvals;
    }
    if (path.includes("/incidents")) {
      return this.data.incidents;
    }
    if (path.includes("/workers")) {
      return this.data.workers;
    }
    if (path.includes("/queues")) {
      return this.data.queues;
    }
    if (path.includes("/agents")) {
      return this.data.agents;
    }
    if (path.includes("/metrics")) {
      return this.data.analytics;
    }
    if (path.includes("/cost")) {
      return this.data.costs;
    }
    if (path.includes("/marketplace")) {
      return this.data.marketplace;
    }
    if (path.includes("/explanations")) {
      return this.data.explanations;
    }
    if (path.includes("/roles")) {
      return this.data.roles;
    }
    if (path.includes("/feature-flags")) {
      return this.data.featureFlags;
    }
    if (path.includes("/models")) {
      return this.data.models;
    }
    if (path.includes("/domains")) {
      return this.data.domainConfigs;
    }
    if (path.includes("/tenants")) {
      return this.data.tenants;
    }
    if (path.includes("/webhooks")) {
      return this.data.webhooks;
    }
    if (path.includes("/users")) {
      return this.data.users;
    }
    if (path.includes("/system-config")) {
      return this.data.systemConfig;
    }
    if (path.includes("/preferences")) {
      return this.data.preferences;
    }
    return { ok: true, body };
  }
}

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  state: "closed" | "open" | "half-open";
}

interface PlatformEnvelope<T> {
  readonly requestId?: string;
  readonly data: T;
}

interface ContractEnvelope<T> {
  readonly envelopeId: string;
  readonly schemaVersion: string;
  readonly payload: T;
  readonly idempotencyKey?: string;
}

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

const DEFAULT_CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
};

export class HttpTransport {
  private readonly fetchImplementation: typeof fetch;
  private readonly fallbackTransport: MockTransport | null;
  private readonly retryConfig: { maxRetries: number; baseDelayMs: number; maxDelayMs: number };
  private readonly circuitBreaker: CircuitBreakerState;

  public constructor(private readonly options: HttpTransportOptions) {
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    this.fallbackTransport = options.fallbackToMock === true ? new MockTransport() : null;
    this.retryConfig = DEFAULT_RETRY_CONFIG;
    this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" };
  }

  private shouldRetry(error: unknown, request: RestClientRequest): boolean {
    if (!this.isRetryAllowed(request)) {
      return false;
    }
    if (error instanceof RestHttpError) {
      return error.status >= 500 || error.status === 429;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      return false;
    }
    return true;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateBackoff(attempt: number): number {
    const delay = this.retryConfig.baseDelayMs * Math.pow(2, attempt);
    return Math.min(delay, this.retryConfig.maxDelayMs);
  }

  private recordFailure(): void {
    this.circuitBreaker.failures += 1;
    this.circuitBreaker.lastFailure = Date.now();
    if (this.circuitBreaker.failures >= DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      this.circuitBreaker.state = "open";
    }
  }

  private recordSuccess(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.state = "closed";
  }

  private canAttempt(): boolean {
    if (this.circuitBreaker.state === "closed") {
      return true;
    }
    if (this.circuitBreaker.state === "open") {
      const elapsed = Date.now() - this.circuitBreaker.lastFailure;
      if (elapsed >= DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeoutMs) {
        this.circuitBreaker.state = "half-open";
        return true;
      }
      return false;
    }
    return this.circuitBreaker.state === "half-open";
  }

  private async parseResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return undefined as T;
    }
    const parsed = await response.json() as T | PlatformEnvelope<T> | ContractEnvelope<T>;
    if (parsed != null && typeof parsed === "object" && "data" in parsed) {
      return (parsed as PlatformEnvelope<T>).data;
    }
    if (parsed != null && typeof parsed === "object" && "envelopeId" in parsed && "schemaVersion" in parsed && "payload" in parsed) {
      return (parsed as ContractEnvelope<T>).payload;
    }
    return parsed as T;
  }

  private isRetryAllowed(request: RestClientRequest): boolean {
    if (request.method === "GET") {
      return true;
    }
    if (request.method === "HEAD" || request.method === "OPTIONS") {
      return true;
    }
    return request.headers.has("Idempotency-Key") || request.headers.has("x-idempotency-key");
  }

  private resolveRequestUrl(path: string): string {
    const trimmed = path.replace(/^\uFEFF+/, "").trim();
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
      return trimmed;
    }
    const normalizedBaseUrl = this.options.baseUrl.replace(/\/$/, "");
    return `${normalizedBaseUrl}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const url = this.resolveRequestUrl(request.path);
    const requestBody = request.body == null ? null : JSON.stringify(this.wrapRequestBody(request));
    const requestHeaders = new Headers({
      "content-type": "application/json",
      "Accept-Version": this.options.acceptVersion ?? DEFAULT_ACCEPT_VERSION_HEADER,
      ...(this.options.headers ?? {}),
      ...Object.fromEntries(request.headers.entries()),
    });

    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt += 1) {
      if (!this.canAttempt()) {
        throw new Error("rest.circuit_open:Circuit breaker is open");
      }

      try {
        const abortController = new AbortController();
        const timeoutMs = this.options.timeoutMs ?? 10_000;
        const timeoutHandle = setTimeout(() => abortController.abort(), timeoutMs);
        let response: Response;
        try {
          response = await this.fetchImplementation(url, {
            method: request.method,
            headers: requestHeaders,
            body: requestBody,
            credentials: this.options.credentials ?? "same-origin",
            mode: this.options.mode ?? "cors",
            signal: abortController.signal,
          });
        } finally {
          clearTimeout(timeoutHandle);
        }

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader == null ? Number.NaN : Number(retryAfterHeader);
          const details = await this.readErrorDetails(response);
          throw new RestHttpError(
            response.status,
            Number.isFinite(retryAfterSeconds) ? Math.round(retryAfterSeconds * 1000) : null,
            details,
          );
        }

        this.recordSuccess();
        return {
          status: response.status,
          data: await this.parseResponse<T>(response),
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error, request)) {
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
        break;
      }
    }

    this.recordFailure();
    if (this.fallbackTransport != null && !(lastError instanceof RestHttpError)) {
      return this.fallbackTransport.send(request);
    }
    throw lastError;
  }

  private async readErrorDetails(response: Response): Promise<{ message?: string; code?: string | null }> {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return {};
    }
    try {
      const parsed = await response.clone().json() as unknown;
      if (parsed == null || typeof parsed !== "object") {
        return {};
      }
      const root = parsed as {
        message?: unknown;
        code?: unknown;
        error?: { message?: unknown; code?: unknown };
      };
      const message = typeof root.error?.message === "string"
        ? root.error.message
        : typeof root.message === "string"
          ? root.message
          : undefined;
      const code = typeof root.error?.code === "string"
        ? root.error.code
        : typeof root.code === "string"
          ? root.code
          : null;
      return { ...(message == null ? {} : { message }), code };
    } catch {
      return {};
    }
  }

  private wrapRequestBody(request: RestClientRequest): unknown {
    if (request.body == null) {
      return null;
    }
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? request.headers.get("x-idempotency-key") ?? undefined;
    return {
      envelopeId: generateStableId("env_"),
      schemaVersion: "v4.3",
      payload: request.body,
      ...(idempotencyKey == null ? {} : { idempotencyKey }),
    } satisfies ContractEnvelope<unknown>;
  }
}

function classifyRestHttpError(status: number): RestHttpErrorCategory {
  if (status === 401 || status === 403) {
    return "auth";
  }
  if (status === 400 || status === 422) {
    return "validation";
  }
  if (status === 406) {
    return "contract";
  }
  if (status >= 500 || status === 429) {
    return "network";
  }
  return "business";
}

export class DefaultRESTClient implements RESTClient {
  public constructor(
    private readonly transport: RestTransport = (request) => new MockTransport().send(request),
    private readonly interceptors: readonly RestClientInterceptor[] = [],
  ) {}

  public get<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({ path, method: "GET", headers: options?.headers ?? new Headers() });
  }

  public post<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({ path, method: "POST", headers: options?.headers ?? new Headers(), body });
  }

  public put<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({ path, method: "PUT", headers: options?.headers ?? new Headers(), body });
  }

  public patch<T>(path: string, body: unknown, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({ path, method: "PATCH", headers: options?.headers ?? new Headers(), body });
  }

  public delete<T>(path: string, options?: RestRequestOptions): Promise<T> {
    return this.request<T>({ path, method: "DELETE", headers: options?.headers ?? new Headers() });
  }

  private async request<T>(initialRequest: RestClientRequest): Promise<T> {
    let request = initialRequest;
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest != null) {
        request = await interceptor.onRequest(request);
      }
    }

    const dispatchResponse = async (currentRequest: RestClientRequest): Promise<RestClientResponse<T>> => {
      let response: RestClientResponse<T> = await this.transport<T>(currentRequest);
      for (const interceptor of [...this.interceptors].reverse()) {
        if (interceptor.onResponse != null) {
          response = await interceptor.onResponse(response);
        }
      }
      return response;
    };

    let dispatch = dispatchResponse;
    for (const interceptor of [...this.interceptors].reverse()) {
      if (interceptor.intercept == null) {
        continue;
      }
      const currentDispatch = dispatch;
      dispatch = (currentRequest: RestClientRequest) => interceptor.intercept!(currentRequest, currentDispatch);
    }

    return (await dispatch(request)).data;
  }
}

export function createRuntimeRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  const baseUrl = options?.baseUrl ?? "/api";
  return new DefaultRESTClient((request) => new HttpTransport({
    baseUrl,
    ...(options?.headers == null ? {} : { headers: options.headers }),
    ...(options?.fetchImplementation == null ? {} : { fetchImplementation: options.fetchImplementation }),
    ...(options?.acceptVersion == null ? {} : { acceptVersion: options.acceptVersion }),
    ...(options?.credentials == null ? {} : { credentials: options.credentials }),
    ...(options?.mode == null ? {} : { mode: options.mode }),
    ...(options?.timeoutMs == null ? {} : { timeoutMs: options.timeoutMs }),
    fallbackToMock: options?.fallbackToMock ?? false,
  }).send(request));
}

export function createRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  return createRuntimeRESTClient(options);
}
