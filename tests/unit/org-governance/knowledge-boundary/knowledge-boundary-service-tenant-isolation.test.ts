import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeShareGrant } from "../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";

function createBoundary(boundaryId: string, ownerOrgNodeId: string, tenantId: string | null = null) {
  return {
    boundaryId,
    ownerOrgNodeId,
    tenantId,
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [] as string[],
    fieldAllowlist: [] as string[],
  };
}

function createGrant(boundaryId: string, requesterOrgNodeId: string, expiresAt: string): KnowledgeShareGrant {
  return {
    grantId: `grant_${boundaryId}_${requesterOrgNodeId}`,
    boundaryId,
    requesterOrgNodeId,
    purpose: "audit",
    expiresAt,
  };
}

// R1-9/R4-46: Tenant isolation enforced in knowledge boundary access
test("KnowledgeBoundaryService tenant isolation - both null: access granted", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", null);

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    null, // requester tenantId
  );

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.tenantId, null);
});

test("KnowledgeBoundaryService tenant isolation - boundary null, requester non-null: access denied", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", null);

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_a", // requester tenantId
  );

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenant isolation - boundary non-null, requester null: access denied", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_a");

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    null, // requester tenantId
  );

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenant isolation - different tenants: access denied", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_a");

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_b", // different requester tenantId
  );

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenant isolation - same tenants: access granted", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_a");

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_a", // same requester tenantId
  );

  assert.strictEqual(decision.allowed, true);
  assert.strictEqual(decision.tenantId, "tenant_a");
});

test("KnowledgeBoundaryService tenant isolation - owner does not bypass tenant check", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_a");

  // Current runtime enforces tenant scope before owner/grant checks.
  const decision = service.evaluateAccess(
    boundary,
    "user_owner",
    "dept_finance", // owner org node
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_b", // different requester tenantId
  );

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenant isolation - grant does not bypass tenant check", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_a");

  const grants: KnowledgeShareGrant[] = [createGrant("kb_finance", "dept_hr", "2026-04-25T00:00:00.000Z")];

  // Current runtime enforces tenant scope before evaluating cross-boundary grants.
  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_hr", // requester via grant
    "audit",
    grants,
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_b", // different requester tenantId
  );

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenantId propagates to access log when boundary has no tenantId", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", null);

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_explicit", // requester tenantId
  );

  // TenantId from requester should propagate
  assert.strictEqual(decision.tenantId, "tenant_explicit");
  assert.strictEqual(decision.accessLog.tenantId, "tenant_explicit");
});

test("KnowledgeBoundaryService tenantId from boundary takes precedence", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", "tenant_boundary");

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_requester", // requester tenantId
  );

  // Boundary tenantId takes precedence
  assert.strictEqual(decision.tenantId, "tenant_boundary");
});

test("KnowledgeBoundaryService tenant isolation - evaluateDynamicAccess with tenantId", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_cross_tenant", "dept_finance", "tenant_a");

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "dept_finance",
    purpose: "access",
    grants: [],
    occurredAt: "2026-04-20T00:00:00.000Z",
    tenantId: "tenant_b", // different tenant
  });

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.violationCodes?.includes("knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService traceBoundaryAccess includes tenant info", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_tenant_trace", "dept_finance", "tenant_xyz");

  service.evaluateAccess(
    boundary,
    "user_trace",
    "dept_finance",
    "testing",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_xyz",
  );

  const logs = service.traceBoundaryAccess("kb_tenant_trace");
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0]?.tenantId, "tenant_xyz");
});

test("KnowledgeBoundaryService listIsolationViolations records tenant scope violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_violation", "dept_finance", "tenant_a");

  // Attempt cross-tenant access
  service.evaluateAccess(
    boundary,
    "user_violation",
    "dept_finance",
    "access",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    "tenant_b",
  );

  const violations = service.listIsolationViolations("kb_violation");
  assert.ok(violations.length > 0);
  assert.ok(violations.some(v => v.code === "knowledge_boundary.tenant_scope_denied"));
});

test("KnowledgeBoundaryService tenant isolation - both tenants null allows access", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_no_tenant", "dept_finance", null);

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
    null,
  );

  assert.strictEqual(decision.allowed, true);
});
