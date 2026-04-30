/**
 * Unit tests for Knowledge Boundary Service
 * Tests cover specific security and correctness issues:
 * - Issue #1985: requiredGrantBoundaryIds check logic inverted, always fails
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeBoundary } from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import type { KnowledgeShareGrant } from "../../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";

function createBoundary(boundaryId: string, ownerOrgNodeId: string, allowedOrgNodeIds: string[] = []): KnowledgeBoundary {
  return {
    boundaryId,
    ownerOrgNodeId,
    namespaceIds: [],
    defaultVisibility: "private",
    allowedOrgNodeIds,
  };
}

function createGrant(overrides: Partial<{
  grantId: string;
  boundaryId: string;
  requesterOrgNodeId: string;
  purpose: string;
  expiresAt: string;
}> = {}): KnowledgeShareGrant {
  return {
    grantId: overrides.grantId ?? "grant-1",
    boundaryId: overrides.boundaryId ?? "kb_finance",
    requesterOrgNodeId: overrides.requesterOrgNodeId ?? "dept_hr",
    purpose: overrides.purpose ?? "audit",
    expiresAt: overrides.expiresAt ?? "2026-12-31T23:59:59.999Z",
    ...overrides,
  };
}

// ─── Issue #1985: requiredGrantBoundaryIds check logic inverted, always fails ─

test("KnowledgeBoundaryService evaluateDynamicPolicy requiredGrantBoundaryIds logic error - demonstrates bug", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Create a grant for this boundary
  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
    }),
  ];

  // Policy requires grant boundary IDs including "kb_finance"
  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants,
    dynamicPolicy: {
      policyId: "iso-policy-1",
      requiredGrantBoundaryIds: ["kb_finance"], // Requires this boundary grant
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // BUG: The logic is inverted
  // Code does: `policy.requiredGrantBoundaryIds.some((grantBoundaryId) => !grantedBoundaryIds.has(grantBoundaryId))`
  // This checks if ANY required ID is NOT in granted IDs
  // If kb_finance is in grants, then grantedBoundaryIds.has("kb_finance") should be TRUE
  // And !grantedBoundaryIds.has("kb_finance") should be FALSE
  // So missingRequiredGrant should be FALSE and access should be ALLOWED
  // But there's a logic error causing it to always fail

  // The bug may be in how grantedBoundaryIds is constructed
  // It filters grants by boundaryId, but then creates a set of boundaryIds from those grants
  // This is the boundaryId of the grant, not the grantId
  // So if you have a grant for kb_finance, grantedBoundaryIds will contain "kb_finance"
  // Then required check should pass...

  // Let's see what happens
  assert.equal(decision.allowed, true); // If this fails, the bug exists
});

test("KnowledgeBoundaryService evaluateDynamicPolicy requiredGrantBoundaryIds with missing grant - demonstrates bug", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  // No grants at all
  const grants: KnowledgeShareGrant[] = [];

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants,
    dynamicPolicy: {
      policyId: "iso-policy-1",
      requiredGrantBoundaryIds: ["kb_finance"], // Requires grant that doesn't exist
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // When no grants exist, the required check SHOULD fail
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some(code => code.includes("required_grant_missing")));
});

test("KnowledgeBoundaryService evaluateDynamicPolicy requiredGrantBoundaryIds when grant exists for different boundary - demonstrates bug", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Grant exists but for a DIFFERENT boundary
  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_hr", // Different boundary
      requesterOrgNodeId: "dept_hr",
    }),
  ];

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants,
    dynamicPolicy: {
      policyId: "iso-policy-1",
      requiredGrantBoundaryIds: ["kb_finance"], // Requires kb_finance grant
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // Should fail because grant is for kb_hr, not kb_finance
  // But let's see if the bug causes it to pass or fail unexpectedly
  assert.equal(decision.allowed, false);
});

test("KnowledgeBoundaryService evaluateDynamicPolicy multiple requiredGrantBoundaryIds", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Grant only covers kb_finance, not kb_hr
  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
    }),
  ];

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants,
    dynamicPolicy: {
      policyId: "iso-policy-1",
      requiredGrantBoundaryIds: ["kb_finance", "kb_hr"], // Requires BOTH
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // Should fail because kb_hr grant is missing
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some(code => code.includes("required_grant_missing")));
});

test("KnowledgeBoundaryService evaluateDynamicPolicy requiredGrantBoundaryIds all present", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  // Grants cover both required boundaries
  const grants = [
    createGrant({
      grantId: "grant-1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
    }),
    createGrant({
      grantId: "grant-2",
      boundaryId: "kb_hr",
      requesterOrgNodeId: "dept_hr",
    }),
  ];

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants,
    dynamicPolicy: {
      policyId: "iso-policy-1",
      requiredGrantBoundaryIds: ["kb_finance", "kb_hr"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // Should pass because both required grants exist
  assert.equal(decision.allowed, true);
});

test("KnowledgeBoundaryService evaluateDynamicPolicy blockedRequesterIds", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked-user",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-policy-1",
      blockedRequesterIds: ["blocked-user"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some(code => code.includes("blocked_requester")));
});

test("KnowledgeBoundaryService evaluateDynamicPolicy deniedPurposes", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance");

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "malicious_export", // Denied purpose
    grants: [],
    dynamicPolicy: {
      policyId: "iso-policy-1",
      deniedPurposes: ["malicious_export"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.some(code => code.includes("denied_purpose")));
});

// ─── Basic functionality tests ─────────────────────────────────────────────────

test("KnowledgeBoundaryService evaluates access and redacts audit logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_finance", "dept_finance", ["dept_audit"]);

  const decision = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_hr",
    "audit",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, false); // Not owner, not in allowed list, no grant
  assert.ok(decision.accessLog.recordId);
  assert.ok(decision.accessLog.occurredAt);
});

test("KnowledgeBoundaryService grants access via allowedOrgNodeIds", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_shared", "dept_finance", ["dept_audit"]);

  const decision = service.evaluateAccess(
    boundary,
    "user_3",
    "dept_audit",
    "review",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, true);
});

test("KnowledgeBoundaryService grants access via ownerOrgNodeId", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_owner", "dept_finance");

  const decision = service.evaluateAccess(
    boundary,
    "user_4",
    "dept_finance",
    "manage",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, true);
});

test("KnowledgeBoundaryService denies access when chinese wall blocks", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_conflict", "dept_legal");
  const chineseWallPolicy = {
    policyId: "cwp_1",
    conflictGroups: {
      "group_finance_legal": ["dept_finance", "dept_legal"],
    },
  };

  const decision = service.evaluateAccess(
    boundary,
    "user_5",
    "dept_finance",
    "access",
    [],
    chineseWallPolicy,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));
});

test("KnowledgeBoundaryService records access log", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_log_test", "dept_finance", ["dept_hr"]);

  service.evaluateAccess(
    boundary,
    "user_log",
    "dept_hr",
    "testing",
    [],
    undefined,
    "2026-04-23T12:00:00.000Z",
  );

  const logs = service.listRedactedLogs("kb_log_test");
  assert.strictEqual(logs.length, 1);
  assert.ok(logs[0]?.requesterId.startsWith("redacted:"));
});

test("KnowledgeBoundaryService returns empty array for unknown boundaryId", () => {
  const service = new KnowledgeBoundaryService();

  const logs = service.listRedactedLogs("kb_unknown");

  assert.deepStrictEqual(logs, []);
});

test("KnowledgeBoundaryService lists isolation violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_violations", "dept_legal");

  service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user",
    requesterOrgNodeId: "dept_hr",
    purpose: "export",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-1",
      blockedRequesterIds: ["blocked_user"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  const violations = service.listIsolationViolations("kb_violations");

  assert.ok(violations.length > 0);
});

test("KnowledgeBoundaryService traceBoundaryAccess returns all logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_trace", "dept_finance", ["dept_hr"]);

  service.evaluateAccess(boundary, "user_1", "dept_hr", "test1", [], undefined, "2026-04-23T10:00:00.000Z");
  service.evaluateAccess(boundary, "user_2", "dept_hr", "test2", [], undefined, "2026-04-23T11:00:00.000Z");

  const logs = service.traceBoundaryAccess("kb_trace");

  assert.strictEqual(logs.length, 2);
});

test("KnowledgeBoundaryService evaluateTenantScope handles null boundary tenant", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary("kb_no_tenant", "dept_finance");

  // Boundary has no tenant, requester has no tenant - should allow
  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants: [],
    tenantId: null,
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  // No dynamic policy, boundary access allowed
  assert.equal(result.allowed, true);
});

test("KnowledgeBoundaryService evaluateTenantScope mismatched tenants", () => {
  const boundary = createBoundary("kb_tenant", "dept_finance");

  // Add tenant to boundary
  (boundary as unknown as { tenantId?: string }).tenantId = "tenant-a";

  const service = new KnowledgeBoundaryService();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "dept_hr",
    purpose: "audit",
    grants: [],
    tenantId: "tenant-b", // Different tenant
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("knowledge_boundary.tenant_scope_denied"));
});
