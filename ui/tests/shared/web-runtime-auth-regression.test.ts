import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createdTokenManager = {
    getToken: vi.fn(() => "session-token"),
    refreshToken: vi.fn(),
  };

  return {
    createdTokenManager,
    BrowserWSClient: vi.fn(() => ({ kind: "browser-ws" })),
    DefaultRESTClient: vi.fn(() => ({ kind: "rest-client" })),
    HttpTransport: vi.fn(() => ({ send: vi.fn() })),
    InMemoryWSClient: vi.fn(() => ({ kind: "memory-ws" })),
    createAuthInterceptor: vi.fn(() => (request: unknown) => request),
    createContractVersionInterceptor: vi.fn(() => (request: unknown) => request),
    createCsrfInterceptor: vi.fn(() => (request: unknown) => request),
    createIdempotencyKeyInterceptor: vi.fn(() => (request: unknown) => request),
    createOfflineQueueInterceptor: vi.fn(() => (request: unknown) => request),
    createTenantInterceptor: vi.fn(() => (request: unknown) => request),
    createTraceInterceptor: vi.fn(() => (request: unknown) => request),
    createPersistentOfflineQueue: vi.fn(() => ({
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      flush: vi.fn(),
    })),
    TokenManager: vi.fn(() => createdTokenManager),
  };
});

vi.mock("@aa/shared-api-client", () => ({
  BrowserWSClient: mocks.BrowserWSClient,
  DefaultRESTClient: mocks.DefaultRESTClient,
  HttpTransport: mocks.HttpTransport,
  InMemoryWSClient: mocks.InMemoryWSClient,
  createAuthInterceptor: mocks.createAuthInterceptor,
  createContractVersionInterceptor: mocks.createContractVersionInterceptor,
  createCsrfInterceptor: mocks.createCsrfInterceptor,
  createIdempotencyKeyInterceptor: mocks.createIdempotencyKeyInterceptor,
  createOfflineQueueInterceptor: mocks.createOfflineQueueInterceptor,
  createTenantInterceptor: mocks.createTenantInterceptor,
  createTraceInterceptor: mocks.createTraceInterceptor,
}));

vi.mock("@aa/shared-sync", () => ({
  createPersistentOfflineQueue: mocks.createPersistentOfflineQueue,
}));

vi.mock("@aa/shared-auth", () => ({
  TokenManager: mocks.TokenManager,
}));

import { createWebRuntimeClients } from "../../apps/web/src/runtime";

describe("web runtime auth regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, {
      WebSocket: vi.fn(),
    });
  });

  it("passes a TokenManager to the auth interceptor instead of a hardcoded token string", () => {
    const providedTokenManager = {
      getToken: vi.fn(() => "provided-token"),
      refreshToken: vi.fn(),
    };

    const result = createWebRuntimeClients({
      tokenManager: providedTokenManager as never,
      tenantId: "tenant-123",
    });

    expect(result.tokenManager).toBe(providedTokenManager);
    expect(mocks.createAuthInterceptor).toHaveBeenCalledWith(providedTokenManager);
    expect(mocks.createAuthInterceptor.mock.calls[0]?.[0]).not.toBe("ui-runtime-access");
    expect(mocks.createTenantInterceptor).toHaveBeenCalledWith("tenant-123");
  });

  it("creates and reuses a TokenManager instance when config does not provide one", () => {
    const result = createWebRuntimeClients({});

    expect(mocks.TokenManager).toHaveBeenCalledTimes(1);
    expect(result.tokenManager).toBe(mocks.createdTokenManager);
    expect(mocks.createAuthInterceptor).toHaveBeenCalledWith(mocks.createdTokenManager);
    expect(mocks.createAuthInterceptor.mock.calls[0]?.[0]).not.toBe("ui-runtime-access");
  });
});
