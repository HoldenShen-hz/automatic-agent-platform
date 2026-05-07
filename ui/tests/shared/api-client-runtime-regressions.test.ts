import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BrowserWSClient,
  DefaultRESTClient,
  HttpTransport,
  RestHttpError,
  createIdempotencyKeyInterceptor,
  createOfflineQueueInterceptor,
  fetchTasks,
  updatePreferences,
  type RestClientRequest,
} from "@aa/shared-api-client";

function createRequest(path = "/tasks"): RestClientRequest {
  return {
    path,
    method: "GET",
    headers: new Headers(),
  };
}

describe("shared api-client runtime regressions", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries retryable HTTP failures and sends Accept-Version on the real transport request", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    let acceptVersion = "";
    const transport = new HttpTransport({
      baseUrl: "https://example.test",
      fetchImplementation: async (_input, init) => {
        attempts += 1;
        acceptVersion = new Headers(init?.headers).get("Accept-Version") ?? "";
        if (attempts < 3) {
          return new Response(JSON.stringify({ ok: false }), {
            status: 503,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, attempts }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    const promise = transport.send<{ ok: boolean; attempts: number }>(createRequest("/api/v1/health"));
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(attempts).toBe(3);
    expect(acceptVersion).toBe("v1");
    expect(response.data).toEqual({ ok: true, attempts: 3 });
  });

  it("opens the circuit breaker after repeated terminal failures and fail-closes subsequent requests", async () => {
    vi.useFakeTimers();
    let attempts = 0;
    const transport = new HttpTransport({
      baseUrl: "https://example.test",
      fetchImplementation: async () => {
        attempts += 1;
        return new Response(JSON.stringify({ ok: false }), {
          status: 503,
          headers: { "content-type": "application/json" },
        });
      },
    });

    for (let index = 0; index < 5; index += 1) {
      const settled = transport
        .send(createRequest("/api/v1/tasks"))
        .then(
          () => ({ ok: true as const }),
          (error) => ({ ok: false as const, error }),
        );
      await vi.runAllTimersAsync();
      const result = await settled;
      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe("rest.http_error:503");
    }

    const attemptsBeforeOpenCheck = attempts;
    await expect(transport.send(createRequest("/api/v1/tasks"))).rejects.toThrow("rest.circuit_open:Circuit breaker is open");
    expect(attempts).toBe(attemptsBeforeOpenCheck);
  });

  it("reconnects websocket clients with backoff and never places auth tokens in the URL", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);

    class FakeSocket {
      public static readonly OPEN = 1;
      public static instances: FakeSocket[] = [];
      public readonly sent: string[] = [];
      public readonly url: string;
      public readonly protocols?: string | string[];
      public readyState = FakeSocket.OPEN;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      public constructor(url: string, protocols?: string | string[]) {
        this.url = url;
        this.protocols = protocols;
        FakeSocket.instances.push(this);
        queueMicrotask(() => {
          this.onopen?.();
        });
      }

      public send(message: string): void {
        this.sent.push(message);
      }

      public close(): void {
        this.onclose?.();
      }
    }

    const client = new BrowserWSClient(FakeSocket as unknown as typeof WebSocket);
    client.subscribe("dashboard", () => undefined);
    client.connect("wss://example.test/realtime", "secret-token");

    await vi.runAllTicks();
    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0]?.url).toBe("wss://example.test/realtime");
    expect(FakeSocket.instances[0]?.url.includes("secret-token")).toBe(false);
    expect(FakeSocket.instances[0]?.protocols).toBe("v1.auth.token");
    expect(FakeSocket.instances[0]?.sent[0]).toContain('"token":"secret-token"');

    FakeSocket.instances[0]?.close();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTicks();

    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1]?.url).toBe("wss://example.test/realtime");
    expect(FakeSocket.instances[1]?.url.includes("secret-token")).toBe(false);
  });

  it("adds standardized pagination, sorting, and filtering query params to list endpoints", async () => {
    let capturedPath = "";
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      capturedPath = request.path;
      return {
        status: 200,
        data: [] as T,
      };
    });

    await fetchTasks(client, {
      page: 2,
      pageSize: 50,
      sort: "updatedAt:desc",
      filter: "status:running",
    });

    expect(capturedPath).toBe("/tasks?page=2&pageSize=50&sort=updatedAt%3Adesc&filter=status%3Arunning");
  });

  it("maps 401/403/429 HTTP failures to explicit UI actions instead of throwing only a generic Error", async () => {
    const cases = [
      { status: 401, expectedAction: "redirect_to_login" as const, retryAfter: null },
      { status: 403, expectedAction: "access_denied" as const, retryAfter: null },
      { status: 429, expectedAction: "backoff_and_retry" as const, retryAfter: 7000 },
    ];

    for (const testCase of cases) {
      const transport = new HttpTransport({
        baseUrl: "https://example.test",
        fetchImplementation: async () => new Response(JSON.stringify({ ok: false }), {
          status: testCase.status,
          headers: {
            "content-type": "application/json",
            ...(testCase.retryAfter == null ? {} : { "retry-after": String(testCase.retryAfter / 1000) }),
          },
        }),
      });

      const result = await transport
        .send(createRequest("/api/v1/tasks"))
        .then(
          () => ({ ok: true as const }),
          (error) => ({ ok: false as const, error }),
        );

      expect(result.ok).toBe(false);
      expect(result.error).toBeInstanceOf(RestHttpError);
      expect((result.error as RestHttpError).status).toBe(testCase.status);
      expect((result.error as RestHttpError).uiAction).toBe(testCase.expectedAction);
      expect((result.error as RestHttpError).retryAfterMs).toBe(testCase.retryAfter);
    }
  });

  it("queues offline writes and short-circuits the request before transport dispatch", async () => {
    const enqueue = vi.fn();
    const transport = vi.fn(async <T,>() => ({
      status: 200,
      data: { ok: true } as T,
    }));
    const queue = { enqueue } as Parameters<typeof createOfflineQueueInterceptor>[0];
    const client = new DefaultRESTClient(transport, [createOfflineQueueInterceptor(queue)]);
    const onlineDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "onLine");

    Object.defineProperty(window.navigator, "onLine", {
      configurable: true,
      get: () => false,
    });

    await expect(client.post("/tasks", { title: "queued" })).rejects.toThrow("rest.offline:Request queued for offline sync");
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(transport).not.toHaveBeenCalled();

    if (onlineDescriptor == null) {
      delete (window.navigator as Navigator & { onLine?: boolean }).onLine;
    } else {
      Object.defineProperty(window.navigator, "onLine", onlineDescriptor);
    }
  });

  it("adds Idempotency-Key headers to mutating requests before hitting the transport", async () => {
    let idempotencyKey = "";
    let legacyIdempotencyKey = "";
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      idempotencyKey = request.headers.get("Idempotency-Key") ?? "";
      legacyIdempotencyKey = request.headers.get("x-idempotency-key") ?? "";
      return {
        status: 200,
        data: { ok: true } as T,
      };
    }, [createIdempotencyKeyInterceptor()]);

    await client.post("/tasks", { title: "dedupe me" });

    expect(idempotencyKey).toBeTruthy();
    expect(legacyIdempotencyKey).toBe(idempotencyKey);
  });

  it("forwards If-Match on preference updates so optimistic locking reaches the transport", async () => {
    let ifMatch = "";
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      ifMatch = request.headers.get("If-Match") ?? "";
      return {
        status: 200,
        data: { ok: true } as T,
      };
    });

    await updatePreferences(client, { theme: "light", locale: "en-US" }, "etag-42");

    expect(ifMatch).toBe("etag-42");
  });
});
