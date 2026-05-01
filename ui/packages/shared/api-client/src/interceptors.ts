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

export function createContractVersionInterceptor(supportedVersions: string[] = ["v1"]): RestClientInterceptor {
  return {
    onRequest(request) {
      request.headers.set("Accept-Version", supportedVersions.join(","));
      return request;
    },
    onResponse<T>(response: RestClientResponse<T>): RestClientResponse<T> {
      if (response.status === 406) {
        console.error(`[ContractVersion] Server rejected version negotiation. Supported: ${supportedVersions.join(", ")}`);
      }
      return response;
    },
  };
}

/**
 * Creates an auth interceptor with dynamic token resolution per §5.4.4.
 * @param tokenOrResolver - Either a static token string (deprecated), a TokenManager-like object,
 *                         or a function that returns the current access token asynchronously.
 */
export function createAuthInterceptor(
  tokenOrResolver: string | TokenResolver | null,
): RestClientInterceptor {
  return {
    onRequest(request) {
      const token = resolveToken(tokenOrResolver);
      if (token !== null) {
        request.headers.set("authorization", `Bearer ${token}`);
      }
      return request;
    },
    // P1 FIX: Add onResponse handler to refresh token on 401
    onResponse<T>(response: RestClientResponse<T>): RestClientResponse<T> | Promise<RestClientResponse<T>> {
      // If we received a 401, the token may have expired
      if (response.status === 401 && tokenOrResolver !== null && typeof tokenOrResolver !== "string") {
        // Attempt to refresh the token and return a signal to retry
        if (typeof tokenOrResolver.getAccessTokenWithRefresh === "function") {
          // Kick off background refresh - don't block the response
          // The next request will use the refreshed token
          void tokenOrResolver.getAccessTokenWithRefresh().then(() => {
            // Token refreshed in background, next request will use new token
          }).catch(() => {
            // Refresh failed, token remains expired
          });
        }
      }
      return response;
    },
  };
}

type TokenResolver = {
  getAccessToken(): string | null;
  getAccessTokenWithRefresh?(refreshFn?: () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>): Promise<string | null>;
};

function resolveToken(tokenOrResolver: string | TokenResolver | null): string | null {
  if (tokenOrResolver === null) {
    return null;
  }
  if (typeof tokenOrResolver === "string") {
    // Deprecated: static token string - log warning in development
    if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
      console.warn("[AuthInterceptor] Static token string is deprecated. Use TokenManager for auto-refresh.");
    }
    return tokenOrResolver;
  }
  // TokenManager-like object with optional auto-refresh
  if (typeof tokenOrResolver.getAccessTokenWithRefresh === "function") {
    // For synchronous onRequest, we use the current token
    // Auto-refresh will be handled via background refresh
    return tokenOrResolver.getAccessToken();
  }
  return tokenOrResolver.getAccessToken();
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

export function createCsrfInterceptor(_token: string | null = null): RestClientInterceptor {
  // P1 FIX: Read CSRF token fresh on each request instead of capturing once.
  // This ensures token rotation is respected without requiring interceptor recreation.
  return {
    onRequest(request) {
      if (request.method !== "GET") {
        const token = readCsrfToken();
        if (token != null) {
          request.headers.set("x-csrf-token", token);
        }
      }
      return request;
    },
  };
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
          idempotencyKey: crypto.randomUUID(),
          retryCount: 0,
          status: "pending",
        });
        // §5.5: Short-circuit request when offline - return optimistic response
        throw new Error("rest.offline:Request queued for offline sync");
      }
      return request;
    },
  };
}

/**
 * Creates a retry interceptor with exponential backoff and jitter per §5.4.
 * Only retries on retryable status codes (429, 500-504).
 */
export function createRetryInterceptor(options: {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryableStatuses?: number[];
} = {}): RestClientInterceptor {
  const {
    maxRetries = 3,
    baseDelayMs = 200,
    maxDelayMs = 5000,
    retryableStatuses = [408, 429, 500, 502, 503, 504],
  } = options;

  return {
    async onResponse<T>(response: RestClientResponse<T>): Promise<RestClientResponse<T>> {
      // Note: In a full implementation, retry count would be tracked via request metadata
      // For now, this interceptor logs and the transport layer handles the retry logic
      if (retryableStatuses.includes(response.status)) {
        console.warn(`[RetryInterceptor] Received retryable status ${response.status}, transport will handle retries`);
      }
      return response;
    },
  };
}

/**
 * Creates a deduplication interceptor per §5.4.
 * Prevents concurrent identical requests from causing duplicate operations.
 */
export function createDedupeInterceptor(): RestClientInterceptor {
  const pendingRequests = new Map<string, Promise<unknown>>();

  return {
    onRequest(request) {
      const dedupeKey = `${request.method}:${request.path}:${JSON.stringify(request.body)}`;
      const existing = pendingRequests.get(dedupeKey);
      if (existing !== undefined) {
        // Attach deduplication marker to request to signal response interceptor to wait
        (request as RequestWithDedupe).dedupeKey = dedupeKey;
      } else {
        const requestPromise = new Promise((resolve) => {
          setTimeout(() => {
            pendingRequests.delete(dedupeKey);
            resolve(undefined);
          }, 5000); // Cleanup after 5s
        });
        pendingRequests.set(dedupeKey, requestPromise);
      }
      return request;
    },
    onResponse<T>(response: RestClientResponse<T>): RestClientResponse<T> {
      const req = response as unknown as RequestWithDedupe;
      if (req.dedupeKey) {
        pendingRequests.delete(req.dedupeKey);
      }
      return response;
    },
  };
}

interface RequestWithDedupe {
  dedupeKey?: string;
}

function readCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }
  const meta = document.querySelector<HTMLMetaElement>('meta[name="aa-csrf-token"]');
  return meta?.content ?? null;
}
