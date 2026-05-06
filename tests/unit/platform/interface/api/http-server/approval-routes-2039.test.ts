/**
 * @fileoverview Unit tests for Approval Routes - Issue #2039
 *
 * ISSUE #2039: approvalId has no authz check - ID injection vulnerability
 *
 * The POST /approvals/:id/decision and POST /v1/approvals/:id/decision routes
 * take the approvalId directly from URL segments without any authorization check
 * to verify the actor has permission to act on that specific approval.
 *
 * This is an ID injection / broken object level authorization (BOLA) vulnerability.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createApprovalRoutes } from "../../../../../../src/platform/interface/api/http-server/approval-routes.js";
import type { ApprovalService } from "../../../../../../src/platform/control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockApprovalService(): ApprovalService {
  return {
    applyDecision: () => {},
  } as unknown as ApprovalService;
}

function createMockInspectService(options?: {
  tenantId?: string | null;
  allowedActorIds?: string[];
  existingApprovalIds?: string[];
}): InspectService {
  const tenantId = options?.tenantId ?? "tenant-a";
  const allowedActorIds = options?.allowedActorIds ?? ["actor-1"];
  const existingApprovalIds = new Set(options?.existingApprovalIds ?? ["appr-1"]);
  return {
    queryDecisionInspectSummaries: () => [
      { decisionId: "appr-1", decisionType: "approval", status: "requested", taskId: "task-1", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: null },
    ],
    getApprovalInspectView: (approvalId: string) => {
      if (!existingApprovalIds.has(approvalId)) {
        const error = new Error(`Approval not found: ${approvalId}`) as Error & { code?: string };
        error.code = "inspect.approval_not_found";
        throw error;
      }
      return {
        task: { id: "task-1", title: "Task 1", status: "queued", tenantId } as never,
        workflowState: null,
        execution: null,
        session: null,
        approval: {
          id: approvalId,
          taskId: "task-1",
          executionId: null,
          status: "requested",
          requestJson: JSON.stringify({
            approvalId,
            taskId: "task-1",
            sourceAgentId: "agent-1",
            reason: "Need review",
            riskLevel: "high",
            options: ["approve", "reject"],
            context: { allowedActorIds },
            timeoutPolicy: "reject",
            createdAt: "2026-04-16T00:00:00.000Z",
          }),
          responseJson: null,
          timeoutPolicy: "reject",
          createdAt: "2026-04-16T00:00:00.000Z",
          respondedAt: null,
        },
        approvals: [],
        operatorActions: [],
        agentExecution: null,
        dispatchDecisions: [],
        remoteRoutingSummary: null,
        leaseHandoverSummary: null,
        recentEvents: [],
        stepResults: [],
        taskResult: null,
        artifacts: [],
        runtimeRecovery: null,
      };
    },
  } as unknown as InspectService;
}

function createMockAuthService(
  roles: string[] = ["viewer", "operator"],
  options?: { actorId?: string; tenantId?: string | null },
): ApiAuthService {
  return {
    requireRole: (headers: Record<string, string | undefined>, role: string) => {
      return {
        actorId: options?.actorId ?? "actor-1",
        roles: roles as ("viewer" | "operator" | "admin")[],
        authMethod: "api_key",
        tenantId: options?.tenantId ?? "tenant-a",
      };
    },
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/approvals", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null, method: string = "GET"): RouteContext {
  return {
    requestId: "req-123",
    request: { method, url: pathname, headers, body } as never,
    route: { pathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  const method = ctx.request.method ?? "GET";
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === pathname) {
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

// ── Issue #2039: Authz hardening in Approval Routes ───────────────────────────

/**
 * ISSUE #2039 TEST SUITE
 *
 * The route now validates approval existence, tenant scope, and actor allow-lists
 * before applying decisions. These tests verify the previous BOLA gap stays closed.
 *
 * GUARDED BEHAVIOR:
 * 1. The actor must be authorized to act on this approval
 * 2. The approval must belong to the actor's tenant scope unless actor is admin
 * 3. Unknown approval IDs must 404
 */

test("ISSUE #2039: POST /approvals/:id/decision rejects actor outside allow-list", async () => {
  const deps = {
    authService: createMockAuthService(["viewer", "operator"], { actorId: "actor-2", tenantId: "tenant-a" }),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService({
      tenantId: "tenant-a",
      allowedActorIds: ["actor-1"],
      existingApprovalIds: ["appr-1"],
    }),
  };
  const routes = createApprovalRoutes(deps);

  const ctx = createMockContext(
    "/approvals/appr-1/decision",
    ["approvals", "appr-1", "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Actor not authorized for this approval/);
});

test("ISSUE #2039: POST /v1/approvals/:id/decision rejects cross-tenant access", async () => {
  const deps = {
    authService: createMockAuthService(["viewer", "operator"], { actorId: "actor-1", tenantId: "tenant-a" }),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService({
      tenantId: "tenant-b",
      allowedActorIds: ["actor-1"],
      existingApprovalIds: ["appr-1"],
    }),
  };
  const routes = createApprovalRoutes(deps);

  const ctx = createMockContext(
    "/v1/approvals/appr-1/decision",
    ["v1", "approvals", "appr-1", "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Actor not authorized for this approval/);
});

test("ISSUE #2039: Approval decision route rejects unknown approval IDs", async () => {
  const deps = {
    authService: createMockAuthService(["viewer", "operator"], { actorId: "actor-1", tenantId: "tenant-a" }),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService({
      tenantId: "tenant-a",
      allowedActorIds: ["actor-1"],
      existingApprovalIds: ["appr-1"],
    }),
  };
  const routes = createApprovalRoutes(deps);

  const nonexistentId = "appr-this-definitely-does-not-exist-12345";
  const ctx = createMockContext(
    `/approvals/${nonexistentId}/decision`,
    ["approvals", nonexistentId, "decision"],
    {},
    JSON.stringify({ decisionType: "rejected" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Approval not found/);
});

test("ISSUE #2039: Route validates approvalId format before processing", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);

  const ctx = createMockContext(
    "/approvals/appr-invalid!/decision",
    ["approvals", "appr-invalid!", "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Invalid approvalId format/);
});

test("ISSUE #2039: No tenant isolation check on approvalId is closed by tenant guard", async () => {
  const deps = {
    authService: createMockAuthService(["viewer", "operator"], { actorId: "actor-1", tenantId: "tenant-a" }),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService({
      tenantId: "tenant-b",
      allowedActorIds: ["actor-1"],
      existingApprovalIds: ["appr-tenant-b-approved"],
    }),
  };
  const routes = createApprovalRoutes(deps);

  const crossTenantApprovalId = "appr-tenant-b-approved";
  const ctx = createMockContext(
    `/approvals/${crossTenantApprovalId}/decision`,
    ["approvals", crossTenantApprovalId, "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Actor not authorized for this approval/);
});

test("ISSUE #2039: applyDecision is not called when authorization fails", async () => {
  let decisionApplied = false;
  const deps = {
    authService: createMockAuthService(["viewer", "operator"], { actorId: "actor-2", tenantId: "tenant-a" }),
    approvalService: {
      applyDecision: () => { decisionApplied = true; },
    } as unknown as ApprovalService,
    inspectService: createMockInspectService({
      tenantId: "tenant-a",
      allowedActorIds: ["actor-1"],
      existingApprovalIds: ["appr-unauthorized-access-attempt"],
    }),
  };
  const routes = createApprovalRoutes(deps);

  const unauthorizedApprovalId = "appr-unauthorized-access-attempt";
  const ctx = createMockContext(
    `/approvals/${unauthorizedApprovalId}/decision`,
    ["approvals", unauthorizedApprovalId, "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  await assert.rejects(() => callRoute(routes, ctx), /Actor not authorized for this approval/);

  assert.equal(decisionApplied, false);
});

// ── Existing behavior tests (to ensure we don't break anything) ───────────────

test("createApprovalRoutes returns 4 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  assert.equal(routes.length, 4);
});

test("GET /approvals returns approval list", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/approvals", ["approvals"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("appr-1"));
});

test("GET /v1/approvals returns approval list", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/v1/approvals", ["v1", "approvals"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("POST /approvals/:id/decision validates decision payload - requires selectedOptionId for option_selected", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext(
    "/approvals/appr-1/decision",
    ["approvals", "appr-1", "decision"],
    {},
    JSON.stringify({ decisionType: "option_selected" }),
    "POST",
  );
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /selectedOptionId/);
  }
});

test("POST /approvals/:id/decision validates decision payload - requires inputText for text_input", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext(
    "/approvals/appr-1/decision",
    ["approvals", "appr-1", "decision"],
    {},
    JSON.stringify({ decisionType: "text_input" }),
    "POST",
  );
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /inputText/);
  }
});

test("POST /approvals/:id/decision rejects dangerous JSON keys", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext(
    "/approvals/appr-1/decision",
    ["approvals", "appr-1", "decision"],
    {},
    "{\"decisionType\":\"confirmed\",\"__proto__\":{\"polluted\":true}}",
    "POST",
  );
  await assert.rejects(
    async () => {
      await callRoute(routes, ctx);
    },
    /reserved key: __proto__/i,
  );
});
