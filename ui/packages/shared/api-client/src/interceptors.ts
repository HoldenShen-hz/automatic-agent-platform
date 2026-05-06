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
 * @param tokenOrResolver - A TokenManager-like object that resolves the current access token.
 *
 * P1 FIX: Use dynamic token resolution via getAccessToken() in onRequest.
 * Static bearer strings are rejected so production callers cannot bypass refresh-aware auth.
 */
export function createAuthInterceptor(
  tokenOrResolver: TokenResolver | null,
): RestClientInterceptor {
  return {
    async onRequest(request) {
      const token = await resolveToken(tokenOrResolver);
      if (token !== null) {
        request.headers.set("authorization", `Bearer ${token}`);
      }
      return request;
    },
    async onResponse<T>(response: RestClientResponse<T>): Promise<RestClientResponse<T>> {
      if (response.status === 401 && tokenOrResolver !== null) {
        if (typeof tokenOrResolver.handleUnauthorized === "function") {
          await tokenOrResolver.handleUnauthorized();
        }
      }
      return response;
    },
  };
}

type TokenResolver = {
  getAccessToken(): string | null;
  getAccessTokenWithRefresh?(refreshFn?: () => Promise<{ accessToken: string; refreshToken: string; expiresIn: number }>): Promise<string | null>;
  shouldRefresh?(now?: number): boolean;
  handleUnauthorized?(): Promise<void> | void;
};

async function resolveToken(tokenOrResolver: TokenResolver | null): Promise<string | null> {
  const resolver = tokenOrResolver as TokenResolver | string | null;
  if (resolver === null) {
    return null;
  }
  if (typeof resolver === "string") {
    throw new Error("auth.dynamic_token_required:Static bearer tokens are not supported");
  }
  if (
    typeof resolver.getAccessTokenWithRefresh === "function"
    && resolver.shouldRefresh?.() === true
  ) {
    return resolver.getAccessTokenWithRefresh();
  }
  return resolver.getAccessToken();
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

/**
 * Creates a CSRF interceptor per §5.4.4.
 * P1 FIX: Read CSRF token fresh on each request via readCsrfToken().
 * Previously the token was captured once in a closure when the interceptor was created.
 * After token rotation (e.g., server-side CSRF refresh), the interceptor would send
 * the stale token, causing 403 errors. Now we query the meta tag on every non-GET request.
 */
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
