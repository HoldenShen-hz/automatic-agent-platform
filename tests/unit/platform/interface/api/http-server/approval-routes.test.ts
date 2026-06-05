import assert from "node:assert/strict";
import test from "node:test";

import { createApprovalRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/approval-routes.js";
import type { ApprovalService } from "../../../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockApprovalService(): ApprovalService {
  return {
    applyDecision: () => {},
    delegatePendingApproval: () => ({
      approvalId: "appr-1",
      taskId: "task-1",
      sourceAgentId: "agent-1",
      reason: "Production rollout",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-16T00:00:00.000Z",
    }),
    requestAdditionalContext: () => ({
      approvalId: "appr-1",
      taskId: "task-1",
      sourceAgentId: "agent-1",
      reason: "Production rollout",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-16T00:00:00.000Z",
    }),
    editPendingApproval: () => ({
      approvalId: "appr-1",
      taskId: "task-1",
      sourceAgentId: "agent-1",
      reason: "Production rollout",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-16T00:00:00.000Z",
    }),
    escalatePendingApproval: () => ({
      approvalId: "appr-1",
      taskId: "task-1",
      sourceAgentId: "agent-1",
      reason: "Production rollout",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-16T00:00:00.000Z",
    }),
    deferPendingApproval: () => ({
      approvalId: "appr-1",
      taskId: "task-1",
      sourceAgentId: "agent-1",
      reason: "Production rollout",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "reject",
      createdAt: "2026-04-16T00:00:00.000Z",
    }),
  } as unknown as ApprovalService;
}

function createMockInspectService(): InspectService {
  return {
    queryDecisionInspectSummaries: () => [
      {
        decisionId: "appr-1",
        decisionType: "approval",
        status: "requested",
        taskId: "task-1",
        requestedAt: "2026-04-16T00:00:00.000Z",
        completedAt: null,
      },
    ],
    getApprovalInspectView: () => ({
      approval: {
        id: "appr-1",
        taskId: "task-1",
        decisionType: "approval",
        status: "completed",
        requestedAt: "2026-04-16T00:00:00.000Z",
        completedAt: "2026-04-16T01:00:00.000Z",
        requestJson: JSON.stringify({
          taskId: "task-1",
          riskLevel: "high",
          reason: "Production rollout",
          context: {
            deadlineAt: "2026-04-16T02:00:00.000Z",
            policySource: "approval.policy.production",
            recommendedOptionId: "approve",
            currentLevel: 1,
            totalLevels: 2,
            escalationTarget: "domain-admin",
          },
        }),
      },
      timeline: { entries: [] },
    }),
  } as unknown as InspectService;
}

function createMockAuthService(roles: string[] = ["viewer", "operator"]): ApiAuthService {
  return {
    requireRole: (headers: Record<string, string | undefined>, role: string) => {
      return { actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null };
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

test("createApprovalRoutes returns 5 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  assert.equal(routes.length, 5);
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

test("GET /approvals throws when auth not configured", async () => {
  const deps = {
    authService: null,
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/approvals", ["approvals"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("POST /approvals/:id/decision applies decision", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/approvals/appr-1/decision", ["approvals", "appr-1", "decision"], {}, JSON.stringify({ decisionType: "confirmed" }), "POST");
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("appr-1"));
});

test("POST /approvals/:id/decision validates decision payload", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/approvals/appr-1/decision", ["approvals", "appr-1", "decision"], {}, JSON.stringify({ decisionType: "option_selected" }), "POST");
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /selectedOptionId/);
  }
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
  const payload = JSON.parse(response.body) as {
    data: {
      approvals: Array<{
        approvalId: string;
        taskId: string;
        riskLevel: string;
        reasonSummary: string;
        deadline?: string;
        policySource?: string;
        recommendedOption?: string;
        currentLevel?: number;
        totalLevels?: number;
        escalationTarget?: string;
      }>;
    };
  };
  assert.deepEqual(payload.data.approvals, [
    {
      approvalId: "appr-1",
      taskId: "task-1",
      riskLevel: "high",
      reasonSummary: "Production rollout",
      deadline: "2026-04-16T02:00:00.000Z",
      policySource: "approval.policy.production",
      recommendedOption: "approve",
      currentLevel: 1,
      totalLevels: 2,
      escalationTarget: "domain-admin",
    },
  ]);
});

test("POST /v1/approvals/:id/decision applies decision with correct actor", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/v1/approvals/appr-2/decision", ["v1", "approvals", "appr-2", "decision"], {}, JSON.stringify({ decisionType: "confirmed" }), "POST");
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("POST /v1/approvals/:id/approve maps alias action to approval decision", async () => {
  let appliedDecisionType: string | null = null;
  const deps = {
    authService: createMockAuthService(),
    approvalService: {
      applyDecision: (decision: { decisionType: string }) => {
        appliedDecisionType = decision.decisionType;
      },
    } as unknown as ApprovalService,
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/v1/approvals/appr-2/approve", ["v1", "approvals", "appr-2", "approve"], {}, JSON.stringify({}), "POST");
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.equal(appliedDecisionType, "confirmed");
});

test("POST /v1/approvals/:id/delegate persists delegate target through approval service", async () => {
  let delegatedTo: string | null = null;
  const deps = {
    authService: createMockAuthService(),
    approvalService: {
      ...createMockApprovalService(),
      delegatePendingApproval: (input: { delegateTo: string }) => {
        delegatedTo = input.delegateTo;
        return {
          approvalId: "appr-2",
          taskId: "task-1",
          sourceAgentId: "agent-1",
          reason: "Production rollout",
          riskLevel: "high",
          options: ["approve", "reject"],
          context: { escalationTarget: input.delegateTo },
          timeoutPolicy: "reject",
          createdAt: "2026-04-16T00:00:00.000Z",
        };
      },
    } as unknown as ApprovalService,
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext(
    "/v1/approvals/appr-2/delegate",
    ["v1", "approvals", "appr-2", "delegate"],
    {},
    JSON.stringify({ delegateTo: "domain-admin" }),
    "POST",
  );
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.equal(delegatedTo, "domain-admin");
});

test("POST /v1/approvals/:id/request-context persists a real operator request", async () => {
  let requestContextCalled = false;
  const deps = {
    authService: createMockAuthService(),
    approvalService: {
      ...createMockApprovalService(),
      requestAdditionalContext: () => {
        requestContextCalled = true;
        return {
          approvalId: "appr-2",
          taskId: "task-1",
          sourceAgentId: "agent-1",
          reason: "Production rollout",
          riskLevel: "high",
          options: ["approve", "reject"],
          context: { additionalContextRequested: true },
          timeoutPolicy: "reject",
          createdAt: "2026-04-16T00:00:00.000Z",
        };
      },
    } as unknown as ApprovalService,
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext(
    "/v1/approvals/appr-2/request-context",
    ["v1", "approvals", "appr-2", "request-context"],
    {},
    JSON.stringify({ comment: "Need more rollout evidence" }),
    "POST",
  );
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.equal(requestContextCalled, true);
});

test("POST /v1/approvals/:id/decision validates decision payload", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);
  const ctx = createMockContext("/v1/approvals/appr-2/decision", ["v1", "approvals", "appr-2", "decision"], {}, JSON.stringify({ decisionType: "text_input" }), "POST");
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
