import assert from "node:assert/strict";
import test from "node:test";

import { KnowledgeBoundaryService } from "../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";

test("KnowledgeBoundaryService evaluates access and redacts audit logs", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_finance",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: ["finance_docs"],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["dept_audit"],
    fieldAllowlist: [],
  };

  const denied = service.evaluateAccess(
    boundary,
    "user_1",
    "dept_hr",
    "investigate",
    [],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(denied.allowed, false);

  const granted = service.evaluateAccess(
    boundary,
    "user_2",
    "dept_hr",
    "audit",
    [{
      grantId: "grant_1",
      boundaryId: "kb_finance",
      requesterOrgNodeId: "dept_hr",
      purpose: "audit",
      expiresAt: "2026-04-21T00:00:00.000Z",
    }],
    undefined,
    "2026-04-20T00:00:00.000Z",
  );
  assert.equal(granted.allowed, true);
  assert.ok(service.listRedactedLogs("kb_finance")[0]?.requesterId.startsWith("redacted:"));
});

test("KnowledgeBoundaryService grants access via allowedOrgNodeIds", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_shared",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "controlled" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: ["dept_audit"],
    fieldAllowlist: [],
  };

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
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.no_chinese_wall"));
});

test("KnowledgeBoundaryService grants access via ownerOrgNodeId", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_owner",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };

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
  const boundary = {
    boundaryId: "kb_conflict",
    ownerOrgNodeId: "dept_legal",
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
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
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.access_denied"));
});

test("KnowledgeBoundaryService allows access when chinese wall passes and boundary allows", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_clear",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "controlled" as const,
    auditOnAccess: true,
    defaultVisibility: "public" as const,
    allowedOrgNodeIds: ["dept_hr"],
    fieldAllowlist: [],
  };
  const chineseWallPolicy = {
    policyId: "cwp_clear",
    conflictGroups: {
      "group_hr_it": ["dept_hr", "dept_it"],
    },
  };

  const decision = service.evaluateAccess(
    boundary,
    "user_6",
    "dept_hr",
    "access",
    [],
    chineseWallPolicy,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
});

test("KnowledgeBoundaryService denies when chinese wall passes but boundary denies", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_combined",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  // Chinese wall clears (dept_hr not in conflict group)
  const chineseWallPolicy = {
    policyId: "cwp_clear",
    conflictGroups: {
      "group_hr_it": ["dept_hr", "dept_it"],
    },
  };

  const decision = service.evaluateAccess(
    boundary,
    "user_7",
    "dept_hr",
    "access",
    [],
    chineseWallPolicy,
    "2026-04-20T00:00:00.000Z",
  );

  // Chinese wall passes but boundary access fails (private boundary, not owner, no allowed org, no grant)
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_clear"));
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.access_denied"));
});

test("KnowledgeBoundaryService returns correct access log record", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_log_test",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "controlled" as const,
    auditOnAccess: true,
    defaultVisibility: "public" as const,
    allowedOrgNodeIds: ["dept_hr"],
    fieldAllowlist: [],
  };

  const decision = service.evaluateAccess(
    boundary,
    "user_log",
    "dept_hr",
    "testing",
    [],
    undefined,
    "2026-04-23T12:00:00.000Z",
  );

  assert.strictEqual(decision.accessLog.recordId, "knowledge_access_kb_log_test_user_log_2026-04-23T12:00:00.000Z");
  assert.strictEqual(decision.accessLog.requesterId, "user_log");
  assert.strictEqual(decision.accessLog.boundaryId, "kb_log_test");
  assert.strictEqual(decision.accessLog.purpose, "testing");
  assert.strictEqual(decision.accessLog.allowed, true);
  assert.strictEqual(decision.accessLog.occurredAt, "2026-04-23T12:00:00.000Z");
});

test("KnowledgeBoundaryService stores multiple logs per boundary", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_multi",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "controlled" as const,
    auditOnAccess: true,
    defaultVisibility: "public" as const,
    allowedOrgNodeIds: ["dept_a", "dept_b"],
    fieldAllowlist: [],
  };

  service.evaluateAccess(boundary, "user_a", "dept_a", "test1", [], undefined, "2026-04-23T10:00:00.000Z");
  service.evaluateAccess(boundary, "user_b", "dept_b", "test2", [], undefined, "2026-04-23T11:00:00.000Z");

  const logs = service.listRedactedLogs("kb_multi");
  assert.strictEqual(logs.length, 2);
  assert.strictEqual(logs[0]?.requesterId, "redacted:user");
  assert.strictEqual(logs[1]?.requesterId, "redacted:user");
});

test("KnowledgeBoundaryService returns empty array for unknown boundaryId", () => {
  const service = new KnowledgeBoundaryService();

  const logs = service.listRedactedLogs("kb_unknown");
  assert.deepStrictEqual(logs, []);
});

test("KnowledgeBoundaryService uses default occurredAt when not provided", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_default_time",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "controlled" as const,
    auditOnAccess: true,
    defaultVisibility: "public" as const,
    allowedOrgNodeIds: ["dept_hr"],
    fieldAllowlist: [],
  };

  // Evaluate without providing occurredAt
  const decision = service.evaluateAccess(
    boundary,
    "user_time",
    "dept_hr",
    "testing",
    [],
    undefined,
  );

  assert.equal(decision.allowed, true);
  assert.ok(decision.accessLog.occurredAt.length > 0);
});

test("KnowledgeBoundaryService deny reason codes include chinese wall codes plus access_denied", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_deny_codes",
    ownerOrgNodeId: "dept_legal",
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };
  const chineseWallPolicy = {
    policyId: "cwp_codes",
    conflictGroups: {
      "group_blocked": ["dept_finance", "dept_legal"],
    },
  };

  const decision = service.evaluateAccess(
    boundary,
    "user_codes",
    "dept_finance",
    "access",
    [],
    chineseWallPolicy,
    "2026-04-20T00:00:00.000Z",
  );

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.chinese_wall_blocked"));
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.conflict_group:group_blocked"));
  assert.ok(decision.reasonCodes.includes("knowledge_boundary.access_denied"));
});

test("KnowledgeBoundaryService evaluates dynamic isolation policies and tracks violations", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = {
    boundaryId: "kb_dynamic",
    ownerOrgNodeId: "dept_finance",
    namespaceIds: [],
    accessPolicy: "strict" as const,
    auditOnAccess: true,
    defaultVisibility: "private" as const,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
  };

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user_blocked",
    requesterOrgNodeId: "dept_hr",
    purpose: "export",
    grants: [],
    dynamicPolicy: {
      policyId: "iso-1",
      blockedRequesterIds: ["user_blocked"],
    },
    relatedBoundaryIds: ["kb_peer"],
    occurredAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.deepStrictEqual(decision.relatedBoundaryIds, ["kb_peer"]);
  assert.equal(decision.dynamicPolicyApplied, true);
  assert.ok(decision.violationCodes?.some((code) => code.includes("knowledge_boundary.blocked_requester:iso-1")));
  assert.equal(service.traceBoundaryAccess("kb_dynamic").length, 1);
  assert.equal(service.listIsolationViolations("kb_dynamic").length >= 1, true);
});