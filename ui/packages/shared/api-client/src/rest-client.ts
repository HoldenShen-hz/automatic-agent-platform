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

export class HttpTransport {
  private readonly fetchImplementation: typeof fetch;
  private readonly fallbackTransport: MockTransport | null;

  public constructor(private readonly options: HttpTransportOptions) {
    this.fetchImplementation = options.fetchImplementation ?? globalThis.fetch.bind(globalThis);
    this.fallbackTransport = options.fallbackToMock === true ? new MockTransport() : null;
  }

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const url = request.path.startsWith("http")
      ? request.path
      : `${this.options.baseUrl.replace(/\/$/, "")}${request.path.startsWith("/") ? request.path : `/${request.path}`}`;
    const requestBody = request.body == null ? null : JSON.stringify(request.body);
    const requestHeaders = new Headers({
      "content-type": "application/json",
      ...(this.options.headers ?? {}),
      ...Object.fromEntries(request.headers.entries()),
    });

    try {
      const response = await this.fetchImplementation(url, {
        method: request.method,
        headers: requestHeaders,
        body: requestBody,
      });

      if (!response.ok) {
        throw new Error(`rest.http_error:${response.status}`);
      }

      return {
        status: response.status,
        data: (await response.json()) as T,
      };
    } catch (error) {
      if (this.fallbackTransport != null) {
        return this.fallbackTransport.send(request);
      }
      throw error;
    }
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

  public patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>({ path, method: "PATCH", headers: new Headers(), body });
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
