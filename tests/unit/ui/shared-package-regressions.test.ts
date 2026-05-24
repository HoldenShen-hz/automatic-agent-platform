import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadRepoModule } from "../../helpers/repo-module.js";

async function loadUiModules() {
  const [
    authModule,
    interceptorModule,
    restClientModule,
    wsClientModule,
    telemetryModule,
  ] = await Promise.all([
    loadRepoModule<{ AuthService: new () => { handleSsoCallback(params: URLSearchParams): Promise<unknown> } }>(
      "ui",
      "packages",
      "shared",
      "auth",
      "src",
      "auth-service.ts",
    ),
    loadRepoModule<{
      createAuthInterceptor: (options: {
        getAccessToken(): string;
        shouldRefresh(): boolean;
        getAccessTokenWithRefresh(): Promise<string>;
      }) => {
        onRequest?: (request: {
          path: string;
          method: "POST" | "PATCH";
          headers: Headers;
          body: unknown;
        }) => Promise<{ headers: Headers }>;
      };
      createCsrfInterceptor: () => {
        onRequest?: (request: {
          path: string;
          method: "POST" | "PATCH";
          headers: Headers;
          body: unknown;
        }) => Promise<{ headers: Headers }>;
      };
    }>("ui", "packages", "shared", "api-client", "src", "interceptors.ts"),
    loadRepoModule<{ MockTransport: new () => { send(request: { path: string; method: string; headers: Headers; body?: unknown }): Promise<{ status: number }> } }>(
      "ui",
      "packages",
      "shared",
      "api-client",
      "src",
      "rest-client.ts",
    ),
    loadRepoModule<{
      BrowserWSClient: new (socket: typeof WebSocket, fallback: unknown) => { connect(url: string, token: string): void };
      InMemoryWSClient: new () => unknown;
    }>("ui", "packages", "shared", "api-client", "src", "ws-client.ts"),
    loadRepoModule<{
      TelemetrySink: new (
        sinks?: unknown[],
        options?: { maxBufferSize?: number; flushIntervalMs?: number },
      ) => {
        record(name: string): void;
        list(): Array<{ name: string }>;
        dispose(): void;
      };
    }>("ui", "packages", "shared", "telemetry", "src", "index.ts"),
  ]);
  return {
    AuthService: authModule.AuthService,
    createAuthInterceptor: interceptorModule.createAuthInterceptor,
    createCsrfInterceptor: interceptorModule.createCsrfInterceptor,
    MockTransport: restClientModule.MockTransport,
    BrowserWSClient: wsClientModule.BrowserWSClient,
    InMemoryWSClient: wsClientModule.InMemoryWSClient,
    TelemetrySink: telemetryModule.TelemetrySink,
  };
}

test("AuthService.handleSsoCallback does not accept URL tokens and redirects into code flow", async () => {
  const { AuthService } = await loadUiModules();
  const authService = new AuthService();
  const params = new URLSearchParams("access_token=leaked-token&refresh_token=leaked-refresh");

  await assert.rejects(
    authService.handleSsoCallback(params),
    /auth\.redirecting/,
  );
});

test("BrowserWSClient keeps token out of the URL and sends it as the first auth message", async () => {
  const { BrowserWSClient, InMemoryWSClient } = await loadUiModules();
  let capturedUrl = "";
  let capturedProtocols: string | string[] | undefined;
  const sentMessages: string[] = [];

  class FakeSocket {
    public static readonly OPEN = 1;
    public readyState = FakeSocket.OPEN;
    public onopen: (() => void) | null = null;
    public onmessage: ((event: { data: string }) => void) | null = null;
    public onclose: (() => void) | null = null;
    public onerror: (() => void) | null = null;

    public constructor(url: string, protocols?: string | string[]) {
      capturedUrl = url;
      capturedProtocols = protocols;
      queueMicrotask(() => this.onopen?.());
    }

    public send(message: string): void {
      sentMessages.push(message);
    }

    public close(): void {
      this.onclose?.();
    }
  }

  const client = new BrowserWSClient(FakeSocket as unknown as typeof WebSocket, new InMemoryWSClient());
  client.connect("ws://secure.example.com/events?tenant=demo", "secret-token");
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(capturedUrl.includes("secret-token"), false);
  assert.equal(String(capturedProtocols).includes("v1.auth.token"), true);
  assert.equal(sentMessages[0]?.includes("\"action\":\"auth\""), true);
  assert.equal(sentMessages[0]?.includes("secret-token"), true);
});

test("createAuthInterceptor resolves a fresh token on each request when refresh is due", async () => {
  const { createAuthInterceptor } = await loadUiModules();
  const interceptor = createAuthInterceptor({
    getAccessToken() {
      return "stale-token";
    },
    shouldRefresh() {
      return true;
    },
    async getAccessTokenWithRefresh() {
      return "fresh-token";
    },
  });
  const request = {
    path: "/api/v1/tasks",
    method: "POST" as const,
    headers: new Headers(),
    body: { ok: true },
  };

  const result = await interceptor.onRequest?.(request);
  assert.equal(result?.headers.get("authorization"), "Bearer fresh-token");
});

test("createCsrfInterceptor reads the current meta token on every write request", async () => {
  const { createCsrfInterceptor } = await loadUiModules();
  let currentToken = "csrf-1";
  const originalDocument = globalThis.document;
  const documentWithQuerySelector = {
    querySelector<T extends Element>(selector: string): T | null {
      if (selector !== 'meta[name="aa-csrf-token"]') {
        return null;
      }
      return { content: currentToken } as unknown as T;
    },
  };
  (globalThis as typeof globalThis & { document?: Document }).document = documentWithQuerySelector as unknown as Document;

  try {
    const interceptor = createCsrfInterceptor();
    const first = await interceptor.onRequest?.({
      path: "/api/v1/tasks",
      method: "POST",
      headers: new Headers(),
      body: {},
    });
    currentToken = "csrf-2";
    const second = await interceptor.onRequest?.({
      path: "/api/v1/tasks/1",
      method: "PATCH",
      headers: new Headers(),
      body: {},
    });

    assert.equal(first?.headers.get("x-csrf-token"), "csrf-1");
    assert.equal(second?.headers.get("x-csrf-token"), "csrf-2");
  } finally {
    (globalThis as typeof globalThis & { document?: unknown }).document = originalDocument;
  }
});

test("TelemetrySink bounds in-memory events by maxBufferSize", async () => {
  const { TelemetrySink } = await loadUiModules();
  const sink = new TelemetrySink([], { maxBufferSize: 2, flushIntervalMs: 60_000 });
  sink.record("event.1");
  sink.record("event.2");
  sink.record("event.3");

  assert.equal(sink.list().length <= 1, true);
  assert.deepEqual(
    sink.list().map((event: { name: string }) => event.name),
    ["event.3"],
  );
  sink.dispose();
});

test("MockTransport respects HTTP method-specific status codes", async () => {
  const { MockTransport } = await loadUiModules();
  const transport = new MockTransport();

  const post = await transport.send({
    path: "/api/v1/tasks",
    method: "POST",
    headers: new Headers(),
    body: { title: "task" },
  });
  const del = await transport.send({
    path: "/api/v1/tasks/task-1",
    method: "DELETE",
    headers: new Headers(),
  });

  assert.equal(post.status, 201);
  assert.equal(del.status, 204);
});

test("UiRuntimeProvider no longer hardcodes demo WS endpoints or synthetic auth tokens", () => {
  const source = readFileSync(
    path.join(process.cwd(), "ui/packages/shared/state/src/index.ts"),
    "utf8",
  );

  assert.equal(source.includes('router.connect("ws://local/ui", "demo-token")'), false);
  assert.equal(source.includes('accessToken: "ui-runtime-access"'), false);
  assert.equal(source.includes('refreshToken: "ui-runtime-refresh"'), false);
  assert.equal(source.includes("if (wsUrl != null && accessToken != null && accessToken.length > 0)"), true);
});
