import test from "node:test";
import assert from "node:assert/strict";

import { KnowledgeBoundaryService } from "../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import {
  evaluateChineseWallPolicy,
  type ChineseWallPolicy,
} from "../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";
import {
  canAccessKnowledgeBoundary,
  resolveKnowledgeAccessPolicy,
} from "../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import { redactKnowledgeAccessLog } from "../../../src/org-governance/knowledge-boundary/access-log/index.js";
import {
  evaluateKnowledgeShare,
  type KnowledgeShareGrant,
} from "../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";

const baseBoundary = {
  boundaryId: "boundary-1",
  ownerOrgNodeId: "team-eng",
  allowedOrgNodeIds: ["team-ops"],
  auditOnAccess: true,
  fieldAllowlist: [],
};

test("KnowledgeBoundaryService.evaluateAccess allows owner access", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-1", tenantId: null },
    "lead-eng",
    "team-eng",
    "improve_model",
    [],
  );
  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.no_chinese_wall"));
});

test("KnowledgeBoundaryService.evaluateAccess denies when chinese wall blocks conflict group", () => {
  const service = new KnowledgeBoundaryService();
  const chineseWallPolicy: ChineseWallPolicy = {
    policyId: "chinese-wall-1",
    conflictGroups: {
      "conflict-a": ["team-eng", "team-sales"],
    },
  };
  // requester is "team-sales", boundary owner is "team-eng" - both in same conflict group
  const decision = service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-chinese-wall", tenantId: null },
    "lead-sales",
    "team-sales",
    "improve_model",
    [],
    chineseWallPolicy,
  );
  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some((c) => c.includes("chinese_wall")));
});

test("KnowledgeBoundaryService.evaluateAccess allows when no chinese wall policy exists", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-no-policy", tenantId: null },
    "engineer",
    "team-ops",
    "improve_model",
    [],
  );
  assert.equal(decision.allowed, true);
});

test("KnowledgeBoundaryService.evaluateAccess records access log", () => {
  const service = new KnowledgeBoundaryService();
  service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-log", tenantId: null },
    "engineer",
    "team-ops",
    "improve_model",
    [],
  );
  const logs = service.traceBoundaryAccess("boundary-log");
  assert.equal(logs.length, 1);
  assert.equal(logs[0]?.requesterId, "engineer");
  assert.equal(logs[0]?.boundaryId, "boundary-log");
});

test("KnowledgeBoundaryService.listRedactedLogs redacts requester IDs", () => {
  const service = new KnowledgeBoundaryService();
  service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-redact", tenantId: null },
    "sensitive-engineer",
    "team-ops",
    "improve_model",
    [],
  );
  const redacted = service.listRedactedLogs("boundary-redact");
  assert.equal(redacted.length, 1);
  assert.ok(redacted[0]?.requesterId.startsWith("redacted:"));
});

test("KnowledgeBoundaryService.listIsolationViolations tracks denied access from chinese wall", () => {
  const service = new KnowledgeBoundaryService();
  const chineseWallPolicy: ChineseWallPolicy = {
    policyId: "chinese-wall-1",
    conflictGroups: {
      "conflict-a": ["team-eng", "team-sales"],
    },
  };
  service.evaluateAccess(
    { ...baseBoundary, boundaryId: "boundary-violations", tenantId: null },
    "lead-sales",
    "team-sales",
    "improve_model",
    [],
    chineseWallPolicy,
  );
  const violations = service.listIsolationViolations("boundary-violations");
  assert.ok(violations.length > 0);
});

test("KnowledgeBoundaryService.evaluateDynamicAccess applies blocked requester policy", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateDynamicAccess({
    boundary: { ...baseBoundary, boundaryId: "boundary-dynamic", tenantId: null },
    requesterId: "blocked-user",
    requesterOrgNodeId: "team-ops",
    purpose: "improve_model",
    grants: [],
    dynamicPolicy: {
      policyId: "dynamic-1",
      blockedRequesterIds: ["blocked-user"],
    },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some((c) => c.includes("blocked_requester")));
});

test("KnowledgeBoundaryService.evaluateDynamicAccess applies denied purpose policy", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateDynamicAccess({
    boundary: { ...baseBoundary, boundaryId: "boundary-purpose", tenantId: null },
    requesterId: "engineer",
    requesterOrgNodeId: "team-ops",
    purpose: "marketing",
    grants: [],
    dynamicPolicy: {
      policyId: "dynamic-1",
      deniedPurposes: ["marketing"],
    },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.some((c) => c.includes("denied_purpose")));
});

test("KnowledgeBoundaryService.evaluateDynamicAccess enforces tenant scope", () => {
  const service = new KnowledgeBoundaryService();
  const decision = service.evaluateDynamicAccess({
    boundary: { ...baseBoundary, boundaryId: "boundary-tenant", tenantId: "tenant-a" },
    requesterId: "engineer",
    requesterOrgNodeId: "team-ops",
    purpose: "improve_model",
    grants: [],
    tenantId: "tenant-b",
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violationCodes?.includes("knowledge_boundary.tenant_scope_denied"));
});

test("evaluateChineseWallPolicy allows access when no conflict groups match", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-1",
    conflictGroups: {
      "conflict-a": ["team-eng", "team-sales"],
    },
  };
  const decision = evaluateChineseWallPolicy(policy, "team-ops", "team-marketing");
  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("evaluateChineseWallPolicy blocks access when same conflict group", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-1",
    conflictGroups: {
      "conflict-a": ["team-eng", "team-sales"],
    },
  };
  const decision = evaluateChineseWallPolicy(policy, "team-eng", "team-sales");
  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedGroupId, "conflict-a");
});

test("evaluateChineseWallPolicy respects wall expiry policy", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-expiring",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2020-01-01T00:00:00.000Z",
  };
  const decision = evaluateChineseWallPolicy(policy, "team-eng", "team-ops", {
    nowIso: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_expired_and_reset"));
});

test("evaluateChineseWallPolicy requires compliance officer for reset when configured", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-restricted",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2020-01-01T00:00:00.000Z",
    resetRequiresApprovalRole: "compliance_officer",
  };
  const decision = evaluateChineseWallPolicy(policy, "team-eng", "team-ops", {
    nowIso: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedGroupId, "reset_requires_compliance_officer");
});

test("evaluateChineseWallPolicy enforces cooldown period after expiry reset", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-cooldown",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2020-01-01T00:00:00.000Z",
    coolDownUntil: "2030-01-01T00:00:00.000Z",
  };
  const decision = evaluateChineseWallPolicy(policy, "team-eng", "team-ops", {
    nowIso: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.blockedGroupId, "cool_down_active");
});

test("evaluateChineseWallPolicy requires residual scan when configured", () => {
  const policy: ChineseWallPolicy = {
    policyId: "chinese-wall-scan",
    conflictGroups: {},
    wallExpiryPolicy: "expires_at",
    expiresAt: "2020-01-01T00:00:00.000Z",
    residualScanRequired: true,
  };
  const noScan = evaluateChineseWallPolicy(policy, "team-eng", "team-ops", {
    nowIso: "2025-01-01T00:00:00.000Z",
    residualScanCompleted: false,
  });
  assert.equal(noScan.allowed, false);
  assert.equal(noScan.blockedGroupId, "residual_scan_required");

  const withScan = evaluateChineseWallPolicy(policy, "team-eng", "team-ops", {
    nowIso: "2025-01-01T00:00:00.000Z",
    residualScanCompleted: true,
  });
  assert.equal(withScan.allowed, true);
});

test("canAccessKnowledgeBoundary allows owner access", () => {
  assert.equal(canAccessKnowledgeBoundary(baseBoundary as any, "team-eng"), true);
});

test("canAccessKnowledgeBoundary allows access for allowed org nodes", () => {
  assert.equal(canAccessKnowledgeBoundary(baseBoundary as any, "team-ops"), true);
});

test("canAccessKnowledgeBoundary denies access for unauthorized org nodes", () => {
  assert.equal(canAccessKnowledgeBoundary(baseBoundary as any, "team-sales"), false);
});

test("resolveKnowledgeAccessPolicy returns strict for private visibility", () => {
  const boundary = { ...baseBoundary, defaultVisibility: "private" as const, accessPolicy: undefined };
  assert.equal(resolveKnowledgeAccessPolicy(boundary as any), "strict");
});

test("resolveKnowledgeAccessPolicy returns controlled for shared visibility", () => {
  const boundary = { ...baseBoundary, defaultVisibility: "shared" as const, accessPolicy: undefined };
  assert.equal(resolveKnowledgeAccessPolicy(boundary as any), "controlled");
});

test("redactKnowledgeAccessLog masks requester ID", () => {
  const log = {
    recordId: "log-1",
    requesterId: "sensitive-user-id",
    boundaryId: "boundary-1",
    purpose: "improve_model",
    allowed: true,
    occurredAt: new Date().toISOString(),
  };
  const redacted = redactKnowledgeAccessLog(log);
  assert.ok(redacted.requesterId.startsWith("redacted:"));
  assert.ok(!redacted.requesterId.includes("sensitive"));
});

test("evaluateKnowledgeShare allows owner access", () => {
  const boundary = { ...baseBoundary, ownerOrgNodeId: "team-eng" };
  const result = evaluateKnowledgeShare(boundary as any, "team-eng", [], new Date().toISOString());
  assert.equal(result?.mode, "summary");
});

test("evaluateKnowledgeShare allows access with valid grant for non-owner requester", () => {
  // Use a boundary where the requester is neither owner nor in allowedOrgNodeIds
  const boundary = { ...baseBoundary, ownerOrgNodeId: "team-eng", allowedOrgNodeIds: [] };
  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant-1",
      boundaryId: "boundary-1",
      requesterOrgNodeId: "team-ops",
      purpose: "improve_model",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    },
  ];
  const result = evaluateKnowledgeShare(boundary as any, "team-ops", grants, new Date().toISOString());
  assert.ok(result !== null);
  assert.equal(result?.mode, "summary");
});

test("evaluateKnowledgeShare returns null for expired grant", () => {
  // Use a boundary where the requester is neither owner nor in allowedOrgNodeIds
  const boundary = { ...baseBoundary, ownerOrgNodeId: "team-eng", allowedOrgNodeIds: [] };
  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant-1",
      boundaryId: "boundary-1",
      requesterOrgNodeId: "team-ops",
      purpose: "improve_model",
      expiresAt: "2020-01-01T00:00:00.000Z",
    },
  ];
  const result = evaluateKnowledgeShare(boundary as any, "team-ops", grants, new Date().toISOString());
  assert.equal(result, null);
});

test("evaluateKnowledgeShare respects field filter transform mode", () => {
  // Use a boundary where the requester is neither owner nor in allowedOrgNodeIds
  const boundary = { ...baseBoundary, ownerOrgNodeId: "team-eng", allowedOrgNodeIds: [] };
  const grants: KnowledgeShareGrant[] = [
    {
      grantId: "grant-1",
      boundaryId: "boundary-1",
      requesterOrgNodeId: "team-ops",
      purpose: "improve_model",
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      transformMode: "field_filter",
      allowedFieldKeys: ["metric_name", "metric_value"],
    },
  ];
  const result = evaluateKnowledgeShare(boundary as any, "team-ops", grants, new Date().toISOString());
  assert.ok(result !== null);
  assert.equal(result?.mode, "field_filter");
  assert.deepEqual(result?.allowedFieldKeys, ["metric_name", "metric_value"]);
});
