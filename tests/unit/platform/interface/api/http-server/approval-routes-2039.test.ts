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

function createMockInspectService(): InspectService {
  return {
    queryDecisionInspectSummaries: () => [
      { decisionId: "appr-1", decisionType: "approval", status: "requested", taskId: "task-1", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: null },
    ],
    getApprovalInspectView: () => ({
      approval: { id: "appr-1", taskId: "task-1", decisionType: "approval", status: "completed", requestedAt: "2026-04-16T00:00:00.000Z", completedAt: "2026-04-16T01:00:00.000Z" },
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

// ── Issue #2039: ID Injection Vulnerability in Approval Routes ────────────────

/**
 * ISSUE #2039 TEST SUITE
 *
 * The approvalId is taken directly from URL segments without authorization check.
 * This allows any authenticated actor to submit decisions for ANY approval by guessing IDs.
 *
 * CURRENT BEHAVIOR: The routes DO NOT verify that the actor has permission to act
 * on the specific approval. The code simply trusts the approvalId from the URL.
 *
 * EXPECTED BEHAVIOR: The routes should verify that:
 * 1. The actor is authorized to act on this approval
 * 2. The approval belongs to a task the actor has access to
 * 3. The actor has the required role for this specific approval
 */

test("ISSUE #2039: POST /approvals/:id/decision accepts any approvalId without authorization", async () => {
  // This test demonstrates the vulnerability: any approvalId is accepted
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);

  // Attacker can guess an approval ID and submit a decision
  const attackerApprovalId = "appr-attacker-guessed-id";
  const ctx = createMockContext(
    `/approvals/${attackerApprovalId}/decision`,
    ["approvals", attackerApprovalId, "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  const response = await callRoute(routes, ctx);

  // The route does not reject the unknown approvalId
  // It processes the decision without verifying authorization
  assert.equal(response?.statusCode, 200);
});

test("ISSUE #2039: POST /v1/approvals/:id/decision accepts any approvalId without authorization", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);

  // Attacker can guess a v1 approval ID
  const attackerApprovalId = "v1-appr-some-other-users-approval";
  const ctx = createMockContext(
    `/v1/approvals/${attackerApprovalId}/decision`,
    ["v1", "approvals", attackerApprovalId, "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  const response = await callRoute(routes, ctx);

  // The route processes the request without authorization check on the approvalId
  assert.equal(response?.statusCode, 200);
});

test("ISSUE #2039: Approval decision route does not verify approval exists before processing", async () => {
  // Even a non-existent approval ID is accepted
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
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

  const response = await callRoute(routes, ctx);

  // The route should 404 for non-existent approvals, but it doesn't
  // This indicates the missing authorization check
  assert.equal(response?.statusCode, 200);
});

test("ISSUE #2039: Route extracts approvalId from segments without validation", async () => {
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);

  // The approvalId is taken directly from segments[1] without validation
  const ctx = createMockContext(
    "/approvals/my-approval-123/decision",
    ["approvals", "my-approval-123", "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  const response = await callRoute(routes, ctx);

  // No error about invalid approval ID format or missing authorization
  assert.equal(response?.statusCode, 200);
});

test("ISSUE #2039: No tenant isolation check on approvalId", async () => {
  // Actors in different tenants should not be able to access each other's approvals
  const deps = {
    authService: createMockAuthService(),
    approvalService: createMockApprovalService(),
    inspectService: createMockInspectService(),
  };
  const routes = createApprovalRoutes(deps);

  // Attacker tries to access another tenant's approval
  const crossTenantApprovalId = "appr-tenant-b-approved";
  const ctx = createMockContext(
    `/approvals/${crossTenantApprovalId}/decision`,
    ["approvals", crossTenantApprovalId, "decision"],
    {},
    JSON.stringify({ decisionType: "confirmed" }),
    "POST",
  );

  const response = await callRoute(routes, ctx);

  // Currently no tenant isolation check - the request succeeds
  assert.equal(response?.statusCode, 200);
});

test("ISSUE #2039: applyDecision is called without authorization verification", async () => {
  // Verify that applyDecision is called even for unauthorized approvals
  let decisionApplied = false;
  const deps = {
    authService: createMockAuthService(),
    approvalService: {
      applyDecision: () => { decisionApplied = true; },
    } as unknown as ApprovalService,
    inspectService: createMockInspectService(),
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

  await callRoute(routes, ctx);

  // Decision was applied even though the actor had no rights to this approval
  assert.equal(decisionApplied, true);
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
