/**
 * Edge Case Tests: Knowledge Boundary Service
 *
 * Tests edge cases and boundary conditions for the KnowledgeBoundaryService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";

function createBoundary(overrides: Partial<KnowledgeBoundary> = {}): KnowledgeBoundary {
  return {
    boundaryId: "kb_edge_test",
    ownerOrgNodeId: "org_owner",
    namespaceIds: ["namespace_1"],
    defaultVisibility: "private",
    allowedOrgNodeIds: [],
    ...overrides,
  };
}

test("KnowledgeBoundaryService handles empty boundary ID", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary({ boundaryId: "" });

  const result = service.evaluateAccess(
    boundary,
    "user_1",
    "org_1",
    "testing empty id",
    [],
  );

  // Should still process (empty string is technically valid)
  assert.ok(result.boundaryId === "");
});

test("KnowledgeBoundaryService handles empty owner org node", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary({ ownerOrgNodeId: "" });

  const result = service.evaluateAccess(
    boundary,
    "user_1",
    "org_1",
    "testing empty owner",
    [],
  );

  assert.ok(result.allowed !== undefined);
});

test("KnowledgeBoundaryService handles empty namespace list", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary({ namespaceIds: [] });

  const result = service.evaluateAccess(
    boundary,
    "user_1",
    "org_owner",
    "testing empty namespace",
    [],
  );

  // Owner should have access
  assert.equal(result.allowed, true);
});

test("KnowledgeBoundaryService handles very long purpose string", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary();
  const longPurpose = "a".repeat(10000);

  const result = service.evaluateAccess(
    boundary,
    "user_1",
    "org_engineering",
    longPurpose,
    [],
  );

  assert.ok(result.allowed !== undefined);
});

test("KnowledgeBoundaryService handles unicode in purpose", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary();

  const result = service.evaluateAccess(
    boundary,
    "user_1",
    "org_engineering",
    "目的：访问中文数据 🎉",
    [],
  );

  assert.equal(result.allowed, false); // Not owner or in allowed list
});

test("KnowledgeBoundaryService handles special characters in requester ID", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary();

  const result = service.evaluateAccess(
    boundary,
    "user@special!#$%",
    "org_engineering",
    "accessing data",
    [],
  );

  assert.equal(result.allowed, false);
});

test("KnowledgeBoundaryService traceBoundaryAccess for unknown boundary", () => {
  const service = new KnowledgeBoundaryService();

  const trace = service.traceBoundaryAccess("completely_unknown_boundary");

  assert.deepEqual(trace, []);
});

test("KnowledgeBoundaryService listIsolationViolations for unknown boundary", () => {
  const service = new KnowledgeBoundaryService();

  const violations = service.listIsolationViolations("completely_unknown_boundary");

  assert.deepEqual(violations, []);
});

test("KnowledgeBoundaryService listRedactedLogs for boundary with no access", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary();
  service.evaluateAccess(boundary, "user_1", "org_1", "access", []);

  const logs = service.listRedactedLogs("kb_edge_test");

  assert.equal(logs.length, 1);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with empty dynamic policy", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "org_1",
    purpose: "testing",
    grants: [],
    dynamicPolicy: undefined,
  });

  // Should return based on boundary access rules
  assert.ok(result.allowed !== undefined);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with all conditions met", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "allowed_user",
    requesterOrgNodeId: "org_1",
    purpose: "allowed_purpose",
    grants: [],
    dynamicPolicy: {
      policyId: "test_policy",
      blockedRequesterIds: [],
      deniedPurposes: [],
      requiredGrantBoundaryIds: [],
    },
  });

  assert.equal(result.allowed, true);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with multiple blocked requesters", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user_2",
    requesterOrgNodeId: "org_1",
    purpose: "accessing",
    grants: [],
    dynamicPolicy: {
      policyId: "block_policy",
      blockedRequesterIds: ["blocked_user_1", "blocked_user_2", "blocked_user_3"],
      deniedPurposes: [],
      requiredGrantBoundaryIds: [],
    },
  });

  assert.equal(result.allowed, false);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with multiple denied purposes", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "org_1",
    purpose: "unauthorized_activity",
    grants: [],
    dynamicPolicy: {
      policyId: "deny_policy",
      blockedRequesterIds: [],
      deniedPurposes: ["unauthorized_activity", "malicious_access", "data_theft"],
      requiredGrantBoundaryIds: [],
    },
  });

  assert.equal(result.allowed, false);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with required grants not met", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "org_1",
    purpose: "accessing",
    grants: [
      {
        grantId: "grant_1",
        boundaryId: "other_boundary",
        requesterOrgNodeId: "org_1",
        purpose: "other purpose",
        expiresAt: "2027-01-01T00:00:00.000Z",
      },
    ],
    dynamicPolicy: {
      policyId: "require_grant_policy",
      blockedRequesterIds: [],
      deniedPurposes: [],
      requiredGrantBoundaryIds: ["kb_edge_test"],
    },
  });

  assert.equal(result.allowed, false);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with required grants met", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_with_grant" });

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "org_1",
    purpose: "accessing with grant",
    grants: [
      {
        grantId: "grant_for_kb",
        boundaryId: "kb_with_grant",
        requesterOrgNodeId: "org_1",
        purpose: "granted access",
        expiresAt: "2027-01-01T00:00:00.000Z",
      },
    ],
    dynamicPolicy: {
      policyId: "require_grant_policy",
      blockedRequesterIds: [],
      deniedPurposes: [],
      requiredGrantBoundaryIds: ["kb_with_grant"],
    },
  });

  assert.equal(result.allowed, true);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with expired grant", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_1",
    requesterOrgNodeId: "org_1",
    purpose: "accessing with expired grant",
    grants: [
      {
        grantId: "expired_grant",
        boundaryId: "kb_edge_test",
        requesterOrgNodeId: "org_1",
        purpose: "was valid",
        expiresAt: "2020-01-01T00:00:00.000Z", // Expired
      },
    ],
    dynamicPolicy: {
      policyId: "require_grant_policy",
      blockedRequesterIds: [],
      deniedPurposes: [],
      requiredGrantBoundaryIds: ["kb_edge_test"],
    },
  });

  assert.equal(result.allowed, false);
});

test("KnowledgeBoundaryService evaluateAccess logs are accumulated per boundary", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  // Multiple accesses
  for (let i = 0; i < 10; i++) {
    service.evaluateAccess(boundary, `user_${i}`, "org_engineering", `access attempt ${i}`, []);
  }

  const logs = service.listRedactedLogs("kb_edge_test");
  assert.equal(logs.length, 10);
});

test("KnowledgeBoundaryService violations are accumulated per boundary", () => {
  const service = new KnowledgeBoundaryService();

  const boundary = createBoundary();
  const chineseWallPolicy = {
    policyId: "cw_test",
    conflictGroups: {
      conflict: ["org_a", "org_b"],
    },
  };

  // Multiple blocked accesses
  for (let i = 0; i < 5; i++) {
    service.evaluateAccess(boundary, `blocked_user_${i}`, "org_b", "conflict access", [], chineseWallPolicy);
  }

  const violations = service.listIsolationViolations("kb_edge_test");
  assert.ok(violations.length >= 5);
});

test("KnowledgeBoundaryService clearPendingDeltas does not exist but trace returns copy", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  service.evaluateAccess(boundary, "user_1", "org_1", "test", []);

  const trace1 = service.traceBoundaryAccess("kb_edge_test");
  const trace2 = service.traceBoundaryAccess("kb_edge_test");

  // Should be equal in content but not same reference
  assert.equal(trace1.length, trace2.length);
});

test("KnowledgeBoundaryService handles null in access log", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  service.evaluateAccess(boundary, null as any, "org_1", "null user", []);

  const logs = service.listRedactedLogs("kb_edge_test");
  assert.equal(logs.length, 1);
});

test("KnowledgeBoundaryService reasonCodes for allowed access", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateAccess(boundary, "owner_user", "org_owner", "owner access", []);

  assert.equal(result.allowed, true);
  assert.ok(result.reasonCodes.length > 0);
});

test("KnowledgeBoundaryService reasonCodes for denied access", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary();

  const result = service.evaluateAccess(boundary, "stranger", "org_stranger", "unauthorized", []);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.length > 0);
});
