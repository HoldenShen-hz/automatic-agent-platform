import type { OfflineQueue } from "@aa/shared-sync";
import { generateStableId, stableSerialize } from "./runtime-support.js";

export interface RestClientRequest {
  readonly path: string;
  readonly method: string;
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
  intercept?<T>(
    request: RestClientRequest,
    next: (request: RestClientRequest) => Promise<RestClientResponse<T>>,
  ): Promise<RestClientResponse<T>>;
}

export interface TokenResolver {
  getAccessToken?(): string | null;
  getAccessTokenWithRefresh?(): Promise<unknown>;
  getToken?(): string | null;
  shouldRefresh?(now?: number): boolean;
  handleUnauthorized?(): Promise<void> | void;
}

export class OfflineQueueRequestQueuedError extends Error {
  public constructor() {
    super("rest.offline:Request queued for offline sync");
  }
}

export class DynamicTokenRequiredError extends Error {
  public constructor() {
    super("auth.dynamic_token_required:Static bearer tokens are not supported");
  }
}

export const DEFAULT_ACCEPT_VERSIONS = ["2026-04-01", "2026-01-01"] as const;

export function createTraceInterceptor(): RestClientInterceptor {
  return {
    onRequest(request) {
      request.headers.set("x-request-id", generateStableId("req_"));
      return request;
    },
  };
}

export function createContractVersionInterceptor(
  versions: readonly string[] = DEFAULT_ACCEPT_VERSIONS,
): RestClientInterceptor {
  return {
    onRequest(request) {
      request.headers.set("Accept-Version", versions.join(","));
      return request;
    },
    onResponse(response) {
      return response;
    },
  };
}

function resolveAccessToken(token: TokenResolver): string | null {
  if (typeof token.getAccessToken === "function") {
    return token.getAccessToken();
  }
  if (typeof token.getToken === "function") {
    return token.getToken();
  }
  return null;
}

function normalizeRefreshResult(result: unknown): string | null {
  if (typeof result === "string") {
    return result;
  }
  if (result != null && typeof result === "object" && "accessToken" in result) {
    const accessToken = (result as { accessToken?: unknown }).accessToken;
    return typeof accessToken === "string" ? accessToken : null;
  }
  return null;
}

export function createAuthInterceptor(token: string | null | TokenResolver): RestClientInterceptor {
  let refreshPromise: Promise<string | null> | null = null;

  async function getRefreshedToken(): Promise<string | null> {
    if (token == null || typeof token === "string" || typeof token.getAccessTokenWithRefresh !== "function") {
      return null;
    }
    if (refreshPromise == null) {
      refreshPromise = Promise.resolve(token.getAccessTokenWithRefresh())
        .then((result) => normalizeRefreshResult(result))
        .finally(() => {
          refreshPromise = null;
        });
    }
    return refreshPromise;
  }

  return {
    async onRequest(request) {
      if (token == null) {
        return request;
      }

      if (typeof token === "string") {
        throw new DynamicTokenRequiredError();
      }

      const accessToken = token.shouldRefresh?.() === true && typeof token.getAccessTokenWithRefresh === "function"
        ? await getRefreshedToken()
        : resolveAccessToken(token);

      if (accessToken != null) {
        request.headers.set("authorization", `Bearer ${accessToken}`);
      }
      return request;
    },
    async onResponse(response) {
      if (response.status === 401 && token != null && typeof token !== "string") {
        await token.handleUnauthorized?.();
      }
      return response;
    },
    async intercept(request, next) {
      const response = await next(request);
      if (response.status !== 401 || token == null || typeof token === "string") {
        return response;
      }

      const refreshedToken = await getRefreshedToken();
      if (refreshedToken == null) {
        await token.handleUnauthorized?.();
        return response;
      }

      const retryRequest: RestClientRequest = {
        ...request,
        headers: new Headers(request.headers),
      };
      retryRequest.headers.set("authorization", `Bearer ${refreshedToken}`);
      const retriedResponse = await next(retryRequest);

      if (retriedResponse.status === 401) {
        await token.handleUnauthorized?.();
      }

      return retriedResponse;
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

export function createCsrfInterceptor(explicitToken?: string | null): RestClientInterceptor {
  return {
    onRequest(request) {
      const token = explicitToken ?? readCsrfToken();
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
      if (
        request.method !== "GET"
        && request.method !== "HEAD"
        && request.method !== "OPTIONS"
        && typeof navigator !== "undefined"
        && navigator.onLine === false
      ) {
        const tenantId = request.headers.get("x-tenant-id") ?? "default-tenant";
        const principalId = request.headers.get("x-principal-id") ?? "ui-operator";
        queue.enqueue({
          id: generateStableId("offline_"),
          endpoint: request.path,
          method: request.method as "POST" | "PUT" | "PATCH" | "DELETE",
          body: request.body,
          createdAt: new Date().toISOString(),
          tenantId,
          traceId: request.headers.get("x-request-id") ?? generateStableId("trace_"),
          headers: extractReplayHeaders(request.headers),
          idempotencyKey: request.headers.get("Idempotency-Key") ?? request.headers.get("x-idempotency-key") ?? undefined,
          principal: {
            principalId,
            tenantId,
            roles: ["operator"],
          },
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
        const idempotencyKey = request.headers.get("Idempotency-Key")
          ?? request.headers.get("x-idempotency-key")
          ?? generateStableId("idem_");
        request.headers.set("Idempotency-Key", idempotencyKey);
        request.headers.set("x-idempotency-key", idempotencyKey);
      }
      return request;
    },
  };
}

export interface RetryInterceptorOptions {
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
}

export function createRetryInterceptor(
  options: RetryInterceptorOptions = {},
): RestClientInterceptor {
  const maxRetries = options.maxRetries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 100;
  return {
    onResponse(response) {
      return response;
    },
    async intercept(request, next) {
      let lastError: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          return await next(request);
        } catch (error) {
          lastError = error;
          if (attempt >= maxRetries || !shouldRetryRequest(error, request)) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
        }
      }
      throw lastError;
    },
  };
}

export interface DedupeInterceptorOptions {
  readonly methods?: readonly RestClientRequest["method"][];
}

export function createDedupeInterceptor(
  options: DedupeInterceptorOptions = {},
): RestClientInterceptor {
  const methods = new Set(options.methods ?? ["POST", "PUT", "PATCH", "DELETE"]);
  const inflight = new Map<string, Promise<RestClientResponse<unknown>>>();
  const observed = new Set<string>();

  function buildKey(request: RestClientRequest): string {
    return `${request.method}:${request.path}:${stableSerialize(request.body ?? null)}`;
  }

  return {
    onRequest(request) {
      if (!methods.has(request.method)) {
        return request;
      }
      const key = buildKey(request);
      if (observed.has(key) || inflight.has(key)) {
        return {
          ...request,
          dedupeKey: key,
        } as RestClientRequest & { dedupeKey: string };
      }
      observed.add(key);
      return request;
    },
    onResponse(response) {
      observed.clear();
      return response;
    },
    async intercept(request, next) {
      if (!methods.has(request.method)) {
        return next(request);
      }
      const key = buildKey(request);
      const existing = inflight.get(key);
      if (existing != null) {
        return existing as Promise<RestClientResponse<never>>;
      }
      const pending = next(request).finally(() => {
        inflight.delete(key);
      });
      inflight.set(key, pending as Promise<RestClientResponse<unknown>>);
      return pending;
    },
  };
}

function shouldRetryRequest(error: unknown, request: RestClientRequest): boolean {
  if (error instanceof DOMException && error.name === "AbortError") {
    return false;
  }
  if (error instanceof Error && "status" in error && typeof (error as { status?: unknown }).status === "number") {
    const status = (error as { status: number }).status;
    if (status !== 429 && status < 500) {
      return false;
    }
  }
  return request.method === "GET"
    || request.method === "HEAD"
    || request.method === "OPTIONS"
    || request.headers.has("Idempotency-Key")
    || request.headers.has("x-idempotency-key");
}

function extractReplayHeaders(headers: Headers): Record<string, string> {
  const replayHeaders = [
    "authorization",
    "x-csrf-token",
    "x-tenant-id",
    "x-principal-id",
    "idempotency-key",
    "x-idempotency-key",
  ];
  return Object.fromEntries(
    replayHeaders.flatMap((name) => {
      const value = headers.get(name);
      return value == null ? [] : [[name, value] as const];
    }),
  );
}
