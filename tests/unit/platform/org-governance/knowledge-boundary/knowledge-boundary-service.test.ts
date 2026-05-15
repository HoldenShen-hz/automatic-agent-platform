import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { KnowledgeBoundaryService } from "../../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeBoundary } from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import type { KnowledgeShareGrant } from "../../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import type { ChineseWallPolicy } from "../../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

function mockBoundary(overrides: Partial<KnowledgeBoundary> = {}): KnowledgeBoundary {
  return {
    boundaryId: "boundary-1",
    name: "Test Boundary",
    boundaryType: "project",
    ownerOrgNodeId: "org-1",
    ownerUserIds: ["owner-1"],
    accessLevel: "restricted",
    classification: "confidential",
    active: true,
    ...overrides,
  };
}

function mockGrant(overrides: Partial<KnowledgeShareGrant> = {}): KnowledgeShareGrant {
  return {
    grantId: "grant-1",
    boundaryId: "boundary-1",
    grantedToOrgNodeId: "org-2",
    grantedByUserId: "owner-1",
    purpose: "collaboration",
    grantedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: null,
    ...overrides,
  };
}

test("KnowledgeBoundaryService evaluateAccess allows access without restrictions", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ ownerOrgNodeId: "org-1" });

  const result = service.evaluateAccess(boundary, "user-1", "org-1", "view", []);

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.boundaryId, "boundary-1");
});

test("KnowledgeBoundaryService evaluateAccess denies when blocked by chinese wall", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ ownerOrgNodeId: "org-1" });
  const policy: ChineseWallPolicy = {
    policyId: "wall-1",
    blockedOrgNodeIds: ["org-2"],
  };

  const result = service.evaluateAccess(boundary, "user-1", "org-2", "view", [], policy);

  assert.strictEqual(result.allowed, false);
});

test("KnowledgeBoundaryService evaluateAccess allows when grant matches", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ ownerOrgNodeId: "org-1" });
  const grant = mockGrant({ boundaryId: "boundary-1", grantedToOrgNodeId: "org-2" });

  const result = service.evaluateAccess(boundary, "user-1", "org-2", "collaboration", [grant]);

  assert.strictEqual(result.allowed, true);
});

test("KnowledgeBoundaryService listRedactedLogs returns redacted logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  service.evaluateAccess(boundary, "user-1", "org-1", "view", []);

  const logs = service.listRedactedLogs("boundary-1");

  assert.ok(logs.length > 0);
});

test("KnowledgeBoundaryService traceBoundaryAccess returns access logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  service.evaluateAccess(boundary, "user-1", "org-1", "view", []);

  const logs = service.traceBoundaryAccess("boundary-1");

  assert.ok(logs.length > 0);
});

test("KnowledgeBoundaryService listIsolationViolations returns violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  const policy: ChineseWallPolicy = { policyId: "wall-1", blockedOrgNodeIds: ["org-2"] };
  service.evaluateAccess(boundary, "user-1", "org-2", "view", [], policy);

  const violations = service.listIsolationViolations("boundary-1");

  assert.ok(violations.length > 0);
});

test("KnowledgeBoundaryService evaluateDynamicAccess with dynamic policy blocking requester", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  const dynamicPolicy = {
    policyId: "dynamic-1",
    blockedRequesterIds: ["blocked-user"],
  };

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked-user",
    requesterOrgNodeId: "org-2",
    purpose: "view",
    grants: [],
    dynamicPolicy,
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.violationCodes!.some((c) => c.includes("blocked_requester")));
});

test("KnowledgeBoundaryService evaluateDynamicAccess with dynamic policy blocking purpose", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  const dynamicPolicy = {
    policyId: "dynamic-1",
    deniedPurposes: ["export"],
  };

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-2",
    purpose: "export",
    grants: [],
    dynamicPolicy,
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.violationCodes!.some((c) => c.includes("denied_purpose")));
});

test("KnowledgeBoundaryService evaluateDynamicAccess with required grant missing", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ boundaryId: "boundary-1" });
  const dynamicPolicy = {
    policyId: "dynamic-1",
    requiredGrantBoundaryIds: ["boundary-1"],
  };

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-1",
    purpose: "view",
    grants: [],
    dynamicPolicy,
  });

  assert.strictEqual(result.allowed, false);
  assert.ok(result.violationCodes!.some((c) => c.includes("required_grant_missing")));
});

test("KnowledgeBoundaryService evaluateDynamicAccess allows when required grant present", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ boundaryId: "boundary-1" });
  const grant = mockGrant({ boundaryId: "boundary-1" });
  const dynamicPolicy = {
    policyId: "dynamic-1",
    requiredGrantBoundaryIds: ["boundary-1"],
  };

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-2",
    purpose: "view",
    grants: [grant],
    dynamicPolicy,
  });

  assert.strictEqual(result.allowed, true);
});

test("KnowledgeBoundaryService evaluateAccess logs access attempt", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();

  service.evaluateAccess(boundary, "user-1", "org-1", "view", []);

  const logs = service.traceBoundaryAccess("boundary-1");
  assert.strictEqual(logs.length, 1);
  assert.strictEqual(logs[0]!.requesterId, "user-1");
  assert.strictEqual(logs[0]!.boundaryId, "boundary-1");
});

test("KnowledgeBoundaryService evaluateAccess records violation when denied", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  const policy: ChineseWallPolicy = { policyId: "wall-1", blockedOrgNodeIds: ["org-2"] };

  service.evaluateAccess(boundary, "user-1", "org-2", "view", [], policy);

  const violations = service.listIsolationViolations("boundary-1");
  assert.ok(violations.length > 0);
});

test("KnowledgeBoundaryService evaluateDynamicAccess dynamicPolicyApplied is true when policy set", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  const dynamicPolicy = { policyId: "dp-1", blockedRequesterIds: ["user-1"] };

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-1",
    purpose: "view",
    grants: [],
    dynamicPolicy,
  });

  assert.strictEqual(result.dynamicPolicyApplied, true);
});

test("KnowledgeBoundaryService evaluateDynamicAccess dynamicPolicyApplied is false when no policy", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();

  const result = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-1",
    purpose: "view",
    grants: [],
  });

  assert.strictEqual(result.dynamicPolicyApplied, false);
});

test("KnowledgeBoundaryService listRedactedLogs removes sensitive data", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary();
  service.evaluateAccess(boundary, "user-1", "org-1", "view", []);

  const logs = service.listRedactedLogs("boundary-1");

  assert.ok(logs.every((log) => log.recordId.length > 0));
});
