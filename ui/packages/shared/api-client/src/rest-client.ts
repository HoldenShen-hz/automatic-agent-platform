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
  WorkflowDTO,
} from "@aa/shared-types";
import { defaultMockApiShape, type MockApiShape } from "./mock-data";
import type { RestClientInterceptor, RestClientRequest, RestClientResponse } from "./interceptors";

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
}

export const DEFAULT_ACCEPT_VERSION_HEADER = "2026-04-01,2026-01-01";

export type RestHttpUiAction = "redirect_to_login" | "access_denied" | "backoff_and_retry" | "none";

export class RestHttpError extends Error {
  public readonly status: number;
  public readonly uiAction: RestHttpUiAction;
  public readonly retryAfterMs: number | null;

  public constructor(status: number, retryAfterMs: number | null = null) {
    super(`rest.http_error:${status}`);
    this.status = status;
    this.retryAfterMs = retryAfterMs;
    this.uiAction = status === 401
      ? "redirect_to_login"
      : status === 403
        ? "access_denied"
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
      status: 200,
      data: payload as T,
    };
  }

  private resolve(path: string, body?: unknown):
    | DashboardSnapshotDTO
    | readonly TaskDTO[]
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

  private shouldRetry(error: unknown): boolean {
    if (error instanceof RestHttpError) {
      return error.status >= 500 || error.status === 429;
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
    const parsed = await response.json() as T | PlatformEnvelope<T>;
    if (parsed != null && typeof parsed === "object" && "data" in parsed) {
      return (parsed as PlatformEnvelope<T>).data;
    }
    return parsed as T;
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const url = request.path.startsWith("http")
      ? request.path
      : `${this.options.baseUrl.replace(/\/$/, "")}${request.path.startsWith("/") ? request.path : `/${request.path}`}`;
    const requestBody = request.body == null ? null : JSON.stringify(request.body);
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
        const response = await this.fetchImplementation(url, {
          method: request.method,
          headers: requestHeaders,
          body: requestBody,
        });

        if (!response.ok) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = retryAfterHeader == null ? Number.NaN : Number(retryAfterHeader);
          throw new RestHttpError(
            response.status,
            Number.isFinite(retryAfterSeconds) ? Math.round(retryAfterSeconds * 1000) : null,
          );
        }

        this.recordSuccess();
        return {
          status: response.status,
          data: await this.parseResponse<T>(response),
        };
      } catch (error) {
        lastError = error;
        if (attempt < this.retryConfig.maxRetries && this.shouldRetry(error)) {
          await this.sleep(this.calculateBackoff(attempt));
          continue;
        }
        break;
      }
    }

    this.recordFailure();
    if (this.fallbackTransport != null) {
      return this.fallbackTransport.send(request);
    }
    throw lastError;
  }
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
  const baseUrl = options?.baseUrl;
  if (baseUrl != null) {
    return new DefaultRESTClient((request) => new HttpTransport({
      baseUrl,
      acceptVersion: options.acceptVersion,
      ...(options?.headers == null ? {} : { headers: options.headers }),
      ...(options?.fetchImplementation == null ? {} : { fetchImplementation: options.fetchImplementation }),
      fallbackToMock: options?.fallbackToMock ?? true,
    }).send(request));
  }
  return new DefaultRESTClient((request) => new MockTransport().send(request));
}

export function createRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  return createRuntimeRESTClient(options);
}
