import type { DashboardSnapshotDTO, TaskDTO, ApprovalDTO, UserPreferenceDTO } from "@aa/shared-types";
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

export class MockTransport {
  public constructor(private readonly data: MockApiShape = defaultMockApiShape) {}

  public async send<T>(request: RestClientRequest): Promise<TransportResponse<T>> {
    const payload = this.resolve(request.path, request.body);
    return {
      status: 200,
      data: payload as T,
    };
  }

  private resolve(path: string, body?: unknown): DashboardSnapshotDTO | readonly TaskDTO[] | readonly ApprovalDTO[] | UserPreferenceDTO | { ok: true } {
    if (path.includes("/dashboard")) {
      return this.data.dashboard;
    }
    if (path.includes("/tasks")) {
      return this.data.tasks;
    }
    if (path.includes("/approvals")) {
      return this.data.approvals;
    }
    if (path.includes("/preferences")) {
      return this.data.preferences;
    }
    return { ok: true };
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
