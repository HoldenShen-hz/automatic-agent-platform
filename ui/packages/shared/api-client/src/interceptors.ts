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

export class OfflineQueueRequestQueuedError extends Error {
  public constructor() {
    super("rest.offline:Request queued for offline sync");
  }
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

export function createCsrfInterceptor(token: string | null = readCsrfToken()): RestClientInterceptor {
  return {
    onRequest(request) {
      if (request.method !== "GET" && token != null) {
        request.headers.set("x-csrf-token", token);
      }
      return request;
    },
  };
}

export interface OfflineQueueRequest extends RestClientRequest {
  readonly queuedAt: string;
  readonly queueId: string;
}

export function createOfflineQueueInterceptor(queue: OfflineQueue): RestClientInterceptor {
  return {
    onRequest(request) {
      if (request.method !== "GET" && typeof navigator !== "undefined" && navigator.onLine === false) {
        queue.enqueue({
          id: crypto.randomUUID(),
          endpoint: request.path,
          method: request.method,
          body: request.body,
          createdAt: new Date().toISOString(),
        });
        throw new OfflineQueueRequestQueuedError();
      }
      return request;
    },
  };
}

function readCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="aa-csrf-token"]');
  return meta?.content ?? null;
}

export function createIdempotencyKeyInterceptor(): RestClientInterceptor {
  return {
    onRequest(request) {
      if (request.method !== "GET") {
        const idempotencyKey = crypto.randomUUID();
        request.headers.set("Idempotency-Key", idempotencyKey);
        request.headers.set("x-idempotency-key", idempotencyKey);
      }
      return request;
    },
  };
}
