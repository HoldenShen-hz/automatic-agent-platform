import type { OfflineQueue } from "@aa/shared-sync";

export interface RestClientRequest {
  readonly path: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly headers: Headers;
  readonly body?: unknown;
}

export interface RestClientResponse<T> {
  readonly status: number;
  readonly data: T;
}

export interface RestClientInterceptor {
  onRequest?(request: RestClientRequest): Promise<RestClientRequest> | RestClientRequest;
  onResponse?<T>(response: RestClientResponse<T>): Promise<RestClientResponse<T>> | RestClientResponse<T>;
}

export function createTraceInterceptor(): RestClientInterceptor {
  return {
    onRequest(request) {
      request.headers.set("x-request-id", crypto.randomUUID());
      return request;
    },
  };
}

export function createAuthInterceptor(token: string | null): RestClientInterceptor {
  return {
    onRequest(request) {
      if (token != null) {
        request.headers.set("authorization", `Bearer ${token}`);
      }
      return request;
    },
  };
}

export function createTenantInterceptor(tenantId: string | null): RestClientInterceptor {
  return {
    onRequest(request) {
      if (tenantId != null) {
        request.headers.set("x-tenant-id", tenantId);
      }
      return request;
    },
  };
}

export function createOfflineQueueInterceptor(queue: OfflineQueue): RestClientInterceptor {
  return {
    onRequest(request) {
      if (request.method !== "GET" && navigator.onLine === false) {
        queue.enqueue({
          id: crypto.randomUUID(),
          endpoint: request.path,
          method: request.method,
          body: request.body,
          createdAt: new Date().toISOString(),
        });
      }
      return request;
    },
  };
}
