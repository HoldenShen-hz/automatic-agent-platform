import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { loadRepoModule } from "../../helpers/repo-module.js";

async function loadUiModules() {
  const [
    authModule,
    endpointsModule,
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
      createTask: (
        client: { post<T>(path: string, body: unknown): Promise<T> },
        body: { title: string; owner?: string; divisionId?: string },
      ) => Promise<unknown>;
      updateTask: (
        client: {
          patch<T>(path: string, body: unknown): Promise<T>;
          put<T>(path: string, body: unknown): Promise<T>;
        },
        taskId: string,
        body: { owner?: string; status?: string },
      ) => Promise<unknown>;
    }>("ui", "packages", "shared", "api-client", "src", "endpoints.ts"),
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
    createTask: endpointsModule.createTask,
    updateTask: endpointsModule.updateTask,
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

test("BrowserWSClient keeps token out of the URL and authenticates via websocket subprotocol", async () => {
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
  assert.equal(String(capturedProtocols).includes("secret-token"), true);
  assert.deepEqual(sentMessages, []);
});

test("BrowserWSClient status listeners do not get overwritten by fallback disconnected state after primary connect", async () => {
  const { BrowserWSClient, InMemoryWSClient } = await loadUiModules();
  const statuses: string[] = [];

  class FakeSocket {
    public static readonly OPEN = 1;
    public readyState = FakeSocket.OPEN;
    public onopen: (() => void) | null = null;
    public onmessage: ((event: { data: string }) => void) | null = null;
    public onclose: (() => void) | null = null;
    public onerror: (() => void) | null = null;

    public constructor(_url: string, _protocols?: string | string[]) {
      queueMicrotask(() => this.onopen?.());
    }

    public send(_message: string): void {}

    public close(): void {
      this.onclose?.();
    }
  }

  const client = new BrowserWSClient(FakeSocket as unknown as typeof WebSocket, new InMemoryWSClient());
  client.connect("ws://secure.example.com/events", "secret-token");
  await new Promise((resolve) => setTimeout(resolve, 0));
  client.onStatusChange((status) => {
    statuses.push(status);
  });

  assert.equal(statuses.at(-1), "connected");
  assert.equal(statuses.includes("disconnected"), false);
});

test("createTask forwards owner to the real backend payload instead of stripping it", async () => {
  const { createTask } = await loadUiModules();
  let capturedPath = "";
  let capturedBody: unknown = null;

  await createTask({
    async post<T>(path: string, body: unknown): Promise<T> {
      capturedPath = path;
      capturedBody = body;
      return { ok: true } as T;
    },
  }, {
    title: "owner-persistence-check",
    divisionId: "platform",
    owner: "platform-owner",
  });

  assert.equal(capturedPath, "/v1/tasks");
  assert.deepEqual(capturedBody, {
    title: "owner-persistence-check",
    divisionId: "platform",
    owner: "platform-owner",
  });
});

test("updateTask uses PATCH so task cockpit actions hit the real task route", async () => {
  const { updateTask } = await loadUiModules();
  let patchPath = "";
  let patchBody: unknown = null;
  let putCalled = false;

  await updateTask({
    async patch<T>(path: string, body: unknown): Promise<T> {
      patchPath = path;
      patchBody = body;
      return { ok: true } as T;
    },
    async put<T>(_path: string, _body: unknown): Promise<T> {
      putCalled = true;
      return { ok: true } as T;
    },
  }, "task-123", {
    owner: "ops-owner",
    status: "running",
  });

  assert.equal(putCalled, false);
  assert.equal(patchPath, "/v1/tasks/task-123");
  assert.deepEqual(patchBody, {
    owner: "ops-owner",
    status: "in_progress",
  });
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
    get cookie() {
      return `aa-csrf-token=${encodeURIComponent(currentToken)}`;
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

test("Task cockpit create flow forwards owner from the form into createTask requests", () => {
  const source = readFileSync(
    path.join(process.cwd(), "ui/packages/features/task-cockpit/src/hooks/index.ts"),
    "utf8",
  );

  assert.equal(source.includes("...(owner == null ? {} : { owner })"), true);
});

test("Browser-router deep links use history navigation instead of hash-only updates", () => {
  const uiCoreSource = readFileSync(
    path.join(process.cwd(), "ui/packages/ui-core/src/components/index.ts"),
    "utf8",
  );
  const platformSource = readFileSync(
    path.join(process.cwd(), "ui/packages/shared/platform/src/web-platform-adapter.ts"),
    "utf8",
  );

  assert.equal(uiCoreSource.includes('window.history.pushState({}, "",'), true);
  assert.equal(uiCoreSource.includes('window.dispatchEvent(new PopStateEvent("popstate"))'), true);
  assert.equal(platformSource.includes('window.history.pushState({}, "",'), true);
  assert.equal(platformSource.includes('window.dispatchEvent(new PopStateEvent("popstate"))'), true);
});
