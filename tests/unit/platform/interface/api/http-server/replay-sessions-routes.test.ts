import assert from "node:assert/strict";
import test from "node:test";

import { createReplaySessionRoutes, clearReplaySessionsStore } from "../../../../../../src/platform/five-plane-interface/api/http-server/replay-sessions-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

// Clear the store before each test to ensure isolation
test.beforeEach(() => {
  clearReplaySessionsStore();
});

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceViewer(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "viewer-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceAdmin(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "admin-1", roles: ["admin"], authMethod: "api_key", tenantId: "tenant:local" }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/api/v1/replay-sessions", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body } as never,
    route: { pathname: routePathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext, method = "GET"): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === ctx.route.pathname) {
        return route.handler(ctx);
      }
    } else if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("createReplaySessionRoutes - GET /api/v1/replay-sessions returns empty list initially", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthServiceViewer() });
  const ctx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 200);
  const body = JSON.parse(result.body);
  const data = body.data;
  assert.deepStrictEqual(data.replaySessions, []);
  assert.strictEqual(data.total, 0);
});

test("createReplaySessionRoutes - POST /api/v1/replay-sessions creates a new replay session", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
    title: "Test Replay Session",
    taskId: "task-123",
    workflowId: "wf-456",
    status: "created",
    inputJson: '{"key":"value"}',
    tenantId: "tenant:test",
  }));

  const result = await callRoute(routes, ctx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  const data = body.data;
  assert.ok(data.replaySessionId.startsWith("replay_"));
  assert.strictEqual(data.title, "Test Replay Session");
  assert.strictEqual(data.taskId, "task-123");
  assert.strictEqual(data.workflowId, "wf-456");
  assert.strictEqual(data.status, "created");
});

test("createReplaySessionRoutes - POST /api/v1/replay-sessions uses defaults for optional fields", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
    title: "Minimal Session",
  }));

  const result = await callRoute(routes, ctx, "POST");

  assert.ok(result != null);
  assert.strictEqual(result.statusCode, 201);
  const body = JSON.parse(result.body);
  const data = body.data;
  assert.ok(data.replaySessionId.startsWith("replay_"));
  assert.strictEqual(data.title, "Minimal Session");
  assert.strictEqual(data.taskId, null);
  assert.strictEqual(data.workflowId, null);
  assert.strictEqual(data.status, "created");
});

test("createReplaySessionRoutes - GET /api/v1/replay-sessions/:id returns 404 for non-existent session", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthServiceViewer() });
  const ctx = createMockContext(
    "/api/v1/replay-sessions/replay_nonexistent",
    ["v1", "replay-sessions", "replay_nonexistent"]
  );

  await assert.rejects(
    async () => callRoute(routes, ctx),
    (err: unknown) => (err as Error).name === "ApiError" && (err as { statusCode: number }).statusCode === 404
  );
});

test("createReplaySessionRoutes - GET /api/v1/replay-sessions/:id returns created session", async () => {
  const authService = createMockAuthService();
  const routes = createReplaySessionRoutes({ authService });

  // Create a session first
  const createCtx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
    title: "Get Test Session",
    taskId: "task-get-test",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const replaySessionId = JSON.parse(createResult!.body).data.replaySessionId;

  // Now fetch it
  const getCtx = createMockContext(
    `/api/v1/replay-sessions/${replaySessionId}`,
    ["v1", "replay-sessions", replaySessionId]
  );
  const getResult = await callRoute(routes, getCtx);

  assert.ok(getResult != null);
  assert.strictEqual(getResult.statusCode, 200);
  const body = JSON.parse(getResult.body);
  const data = body.data;
  assert.strictEqual(data.replaySessionId, replaySessionId);
  assert.strictEqual(data.title, "Get Test Session");
  assert.strictEqual(data.taskId, "task-get-test");
});

test("createReplaySessionRoutes - DELETE /api/v1/replay-sessions/:id deletes session", async () => {
  const authService = createMockAuthService();
  const routes = createReplaySessionRoutes({ authService });

  // Create a session
  const createCtx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
    title: "Delete Test Session",
  }));
  const createResult = await callRoute(routes, createCtx, "POST");
  const replaySessionId = JSON.parse(createResult!.body).data.replaySessionId;

  // Delete it
  const deleteCtx = createMockContext(
    `/api/v1/replay-sessions/${replaySessionId}`,
    ["v1", "replay-sessions", replaySessionId]
  );
  const deleteResult = await callRoute(routes, deleteCtx, "DELETE");

  assert.ok(deleteResult != null);
  assert.strictEqual(deleteResult.statusCode, 200);
  const deleteBody = JSON.parse(deleteResult.body);
  const deleteData = deleteBody.data;
  assert.strictEqual(deleteData.replaySessionId, replaySessionId);
  assert.strictEqual(deleteData.status, "deleted");

  // Verify it's gone
  await assert.rejects(
    async () => {
      const getCtx = createMockContext(
        `/api/v1/replay-sessions/${replaySessionId}`,
        ["v1", "replay-sessions", replaySessionId]
      );
      return callRoute(routes, getCtx);
    },
    (err: unknown) => (err as Error).name === "ApiError" && (err as { statusCode: number }).statusCode === 404
  );
});

test("createReplaySessionRoutes - GET /api/v1/replay-sessions with pagination", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthService() });

  // Create multiple sessions
  for (let i = 0; i < 5; i++) {
    const createCtx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
      title: `Session ${i}`,
    }));
    await callRoute(routes, createCtx, "POST");
  }

  // Get with limit
  const ctx = createMockContext("/api/v1/replay-sessions?limit=3", ["v1", "replay-sessions"]);
  const result = await callRoute(routes, ctx);

  assert.ok(result != null);
  const body = JSON.parse(result.body);
  const data = body.data;
  assert.strictEqual(data.replaySessions.length, 3);
  assert.strictEqual(data.total, 5);
  assert.strictEqual(data.limit, 3);
});

test("createReplaySessionRoutes - rejects empty title", async () => {
  const routes = createReplaySessionRoutes({ authService: createMockAuthService() });
  const ctx = createMockContext("/api/v1/replay-sessions", ["v1", "replay-sessions"], {}, JSON.stringify({
    title: "",
  }));

  await assert.rejects(
    async () => callRoute(routes, ctx, "POST"),
    /String must contain at least 1 character/
  );
});