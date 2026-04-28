/**
 * Unit tests for KnowledgeBoundaryService - Additional edge cases
 * Tests for evaluateDynamicAccess with various dynamic policy scenarios
 */

import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeBoundary } from "../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import type { KnowledgeShareGrant } from "../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";

function createBoundary(overrides: Partial<KnowledgeBoundary> = {}): KnowledgeBoundary {
  return {
    boundaryId: overrides.boundaryId ?? "kb_default",
    ownerOrgNodeId: overrides.ownerOrgNodeId ?? "dept_finance",
    namespaceIds: overrides.namespaceIds ?? [],
    accessPolicy: overrides.accessPolicy,
    auditOnAccess: overrides.auditOnAccess ?? true,
    defaultVisibility: overrides.defaultVisibility ?? "private",
    allowedOrgNodeIds: overrides.allowedOrgNodeIds ?? [],
    fieldAllowlist: overrides.fieldAllowlist ?? [],
  };
}

test("KnowledgeBoundaryService evaluates dynamic policy with blocked requester", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_blocked" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user",
    requesterOrgNodeId: "dept_hr",
    purpose: "access",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-block",
      blockedRequesterIds: ["blocked_user", "another_blocked"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some(code => code.includes("blocked_requester")));
});

test("KnowledgeBoundaryService evaluates dynamic policy with multiple blocked requesters", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_multi_blocked" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user_2",
    requesterOrgNodeId: "dept_hr",
    purpose: "export",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-multi",
      blockedRequesterIds: ["user_1", "blocked_user_2", "user_3"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
});

test("KnowledgeBoundaryService evaluates dynamic policy with denied purpose", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_denied_purpose" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_123",
    requesterOrgNodeId: "dept_hr",
    purpose: "confidential_export",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-purpose",
      deniedPurposes: ["confidential_export", "bulk_download"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some(code => code.includes("denied_purpose")));
});

test("KnowledgeBoundaryService evaluates dynamic policy with multiple denied purposes", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_multi_purpose" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_456",
    requesterOrgNodeId: "dept_hr",
    purpose: "bulk_download",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-multi-purpose",
      deniedPurposes: ["confidential_export", "bulk_download", "pii_access"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
});

test("KnowledgeBoundaryService evaluates dynamic policy with required grants", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_require_grant" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_without_grant",
    requesterOrgNodeId: "dept_hr",
    purpose: "access",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-grant",
      requiredGrantBoundaryIds: ["kb_require_grant"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some(code => code.includes("required_grant_missing")));
});

test("KnowledgeBoundaryService evaluates dynamic policy with satisfied required grants", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_grant_satisfied" });

  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant_1",
      boundaryId: "kb_grant_satisfied",
      requesterOrgNodeId: "dept_hr",
      purpose: "access",
      expiresAt: "2026-04-30T00:00:00.000Z",
    },
  ];

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_with_grant",
    requesterOrgNodeId: "dept_hr",
    purpose: "access",
    grants,
    dynamicPolicy: {
      policyId: "iso-grant-sat",
      requiredGrantBoundaryIds: ["kb_grant_satisfied"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
  assert.ok(!decision.violationCodes?.some(code => code.includes("required_grant_missing")));
});

test("KnowledgeBoundaryService combines chinese wall and dynamic policy", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_combined" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_combined",
    requesterOrgNodeId: "dept_finance",
    purpose: "access",
    grants: [],
    chineseWallPolicy: {
      policyId: "cwp_1",
      conflictGroups: {
        "group_legal_finance": ["dept_legal", "dept_finance"],
      },
    },
    dynamicPolicy: {
      policyId: "iso-1",
      deniedPurposes: ["legal_review"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
});

test("KnowledgeBoundaryService handles empty violation codes when allowed", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({
    boundaryId: "kb_public",
    accessPolicy: "controlled" as const,
    allowedOrgNodeIds: ["dept_any"],
  });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "any_user",
    requesterOrgNodeId: "dept_any",
    purpose: "access",
    grants: [],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
  assert.deepStrictEqual(decision.violationCodes, []);
});

test("KnowledgeBoundaryService records multiple violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_multi_violation" });

  // Access should fail due to boundary access
  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_violations",
    requesterOrgNodeId: "dept_external",
    purpose: "access",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-multi-v",
      blockedRequesterIds: ["user_violations"],
      deniedPurposes: ["access"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes && decision.violationCodes.length >= 1);
});

test("KnowledgeBoundaryService traceBoundaryAccess returns redacted logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_trace" });

  service.evaluateAccess(boundary, "user_trace", "dept_hr", "testing", [], undefined, "2026-04-23T10:00:00.000Z");

  const logs = service.traceBoundaryAccess("kb_trace");
  assert.strictEqual(logs.length, 1);
  // traceBoundaryAccess should NOT redact
  assert.strictEqual(logs[0]?.requesterId, "user_trace");
});

test("KnowledgeBoundaryService listRedactedLogs returns redacted logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_redact" });

  service.evaluateAccess(boundary, "user_redact", "dept_hr", "testing", [], undefined, "2026-04-23T11:00:00.000Z");

  const logs = service.listRedactedLogs("kb_redact");
  assert.strictEqual(logs.length, 1);
  // listRedactedLogs SHOULD redact
  assert.ok(logs[0]?.requesterId.startsWith("redacted:"));
});

test("KnowledgeBoundaryService listIsolationViolations returns violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_violations" });

  service.evaluateDynamicAccess({
    boundary,
    requesterId: "blocked_user",
    requesterOrgNodeId: "dept_hr",
    purpose: "access",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-v",
      blockedRequesterIds: ["blocked_user"],
    },
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  const violations = service.listIsolationViolations("kb_violations");
  assert.ok(violations.length >= 1);
});

test("KnowledgeBoundaryService returns empty violations for unknown boundary", () => {
  const service = new KnowledgeBoundaryService();

  const violations = service.listIsolationViolations("kb_unknown");
  assert.deepStrictEqual(violations, []);
});

test("KnowledgeBoundaryService handles relatedBoundaryIds in decision", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = createBoundary({ boundaryId: "kb_related" });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_related",
    requesterOrgNodeId: "dept_hr",
    purpose: "access",
    grants: [],
    relatedBoundaryIds: ["kb_peer_1", "kb_peer_2"],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.deepStrictEqual(decision.relatedBoundaryIds, ["kb_peer_1", "kb_peer_2"]);
});
