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

export type RestTransport = <T>(request: RestClientRequest) => Promise<TransportResponse<T>>;

export interface RESTClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

export interface HttpTransportOptions {
  readonly baseUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly fetchImplementation?: typeof fetch;
  readonly fallbackToMock?: boolean;
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

export interface CircuitBreakerState {
  readonly failures: number;
  readonly lastFailure: number;
  readonly state: "closed" | "open" | "half-open";
}

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 5000,
  retryableStatuses: new Set([408, 429, 500, 502, 503, 504]),
};

function isRetryableError(status: number): boolean {
  return DEFAULT_RETRY_CONFIG.retryableStatuses.has(status);
}

function calculateBackoffDelay(attempt: number, jitter: number): number {
  const exponentialDelay = Math.min(
    DEFAULT_RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    DEFAULT_RETRY_CONFIG.maxDelayMs,
  );
  const jitterOffset = exponentialDelay * jitter;
  return Math.floor(exponentialDelay + jitterOffset);
}

export class HttpTransport {
  private readonly fetchImplementation: typeof fetch;
  private readonly fallbackTransport: MockTransport | null;
  private circuitBreaker: CircuitBreakerState = { failures: 0, lastFailure: 0, state: "closed" };
  private readonly circuitBreakerThreshold = 5;
  private readonly circuitBreakerResetMs = 30000;

  public constructor(private readonly options: HttpTransportOptions) {
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    this.fallbackTransport = options.fallbackToMock === true ? new MockTransport() : null;
  }

  private shouldRetry(): boolean {
    const now = Date.now();
    if (this.circuitBreaker.state === "open") {
      if (now - this.circuitBreaker.lastFailure > this.circuitBreakerResetMs) {
        this.circuitBreaker = { ...this.circuitBreaker, state: "half-open" };
        return true;
      }
      return false;
    }
    return true;
  }

  private recordFailure(): void {
    const newFailures = this.circuitBreaker.failures + 1;
    if (newFailures >= this.circuitBreakerThreshold) {
      this.circuitBreaker = { failures: newFailures, lastFailure: Date.now(), state: "open" };
    } else {
      this.circuitBreaker = { ...this.circuitBreaker, failures: newFailures, lastFailure: Date.now() };
    }
  }

  private recordSuccess(): void {
    this.circuitBreaker = { failures: 0, lastFailure: 0, state: "closed" };
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const url = request.path.startsWith("http")
      ? request.path
      : `${this.options.baseUrl.replace(/\/$/, "")}${request.path.startsWith("/") ? request.path : `/${request.path}`}`;
    const requestBody = request.body == null ? null : JSON.stringify(request.body);
    const requestHeaders = new Headers({
      "content-type": "application/json",
      "Accept-Version": "v1",
      ...(this.options.headers ?? {}),
      ...Object.fromEntries(request.headers.entries()),
    });

    if (!this.shouldRetry()) {
      if (this.fallbackTransport != null) {
        return this.fallbackTransport.send(request);
      }
      throw new Error("rest.circuit_open:Circuit breaker is open");
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= DEFAULT_RETRY_CONFIG.maxRetries; attempt++) {
      try {
        const response = await this.fetchImplementation(url, {
          method: request.method,
          headers: requestHeaders,
          body: requestBody,
        });

        if (!response.ok) {
          // Handle 406 Not Acceptable - server doesn't support requested version
          if (response.status === 406) {
            this.recordFailure();
            throw new Error("rest.version_not_supported:Server contract version not supported");
          }
          if (isRetryableError(response.status) && attempt < DEFAULT_RETRY_CONFIG.maxRetries) {
            const jitter = Math.random() * 0.3 - 0.15;
            const delay = calculateBackoffDelay(attempt, jitter);
            await new Promise((resolve) => setTimeout(resolve, delay));
            lastError = new Error(`rest.http_error:${response.status}`);
            continue;
          }
          this.recordFailure();
          throw new Error(`rest.http_error:${response.status}`);
        }

        this.recordSuccess();
        return {
          status: response.status,
          data: (await response.json()) as T,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < DEFAULT_RETRY_CONFIG.maxRetries) {
          const jitter = Math.random() * 0.3 - 0.15;
          const delay = calculateBackoffDelay(attempt, jitter);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

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

  public get<T>(path: string): Promise<T> {
    return this.request<T>({ path, method: "GET", headers: new Headers() });
  }

  public post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ path, method: "POST", headers: new Headers(), body });
  }

  public put<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ path, method: "PUT", headers: new Headers(), body });
  }

  public patch<T>(path: string, body: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    const headers = new Headers();
    if (extraHeaders != null) {
      for (const [key, value] of Object.entries(extraHeaders)) {
        headers.set(key, value);
      }
    }
    return this.request<T>({ path, method: "PATCH", headers, body });
  }

  public delete<T>(path: string): Promise<T> {
    return this.request<T>({ path, method: "DELETE", headers: new Headers() });
  }

  private async request<T>(initialRequest: RestClientRequest): Promise<T> {
    let request = initialRequest;
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest != null) {
        request = await interceptor.onRequest(request);
      }
    }

    let response: RestClientResponse<T> = await this.transport<T>(request);
    for (const interceptor of [...this.interceptors].reverse()) {
      if (interceptor.onResponse != null) {
        response = await interceptor.onResponse(response);
      }
    }
    return response.data;
  }
}

export function createRuntimeRESTClient(options?: Partial<HttpTransportOptions>): RESTClient {
  const baseUrl = options?.baseUrl;
  if (baseUrl != null) {
    return new DefaultRESTClient((request) => new HttpTransport({
      baseUrl,
      ...(options?.headers == null ? {} : { headers: options.headers }),
      ...(options?.fetchImplementation == null ? {} : { fetchImplementation: options.fetchImplementation }),
      fallbackToMock: options?.fallbackToMock ?? true,
    }).send(request));
  }
  return new DefaultRESTClient((request) => new MockTransport().send(request));
}
