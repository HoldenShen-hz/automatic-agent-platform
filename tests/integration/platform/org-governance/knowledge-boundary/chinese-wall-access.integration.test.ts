import assert from "node:assert/strict";
import test from "node:test";
import {
  ChineseWallAccessSaga,
  type ChineseWallAccessStep,
} from "../../../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import {
  KnowledgeBoundaryService,
} from "../../../../../src/org-governance/knowledge-boundary/knowledge-boundary-service.js";
import type { KnowledgeBoundary } from "../../../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import type { KnowledgeShareGrant } from "../../../../../src/org-governance/knowledge-boundary/sharing-gate/index.js";
import type { ChineseWallPolicy } from "../../../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";

function mockBoundary(overrides: Partial<KnowledgeBoundary> = {}): KnowledgeBoundary {
  return {
    boundaryId: "boundary-1",
    ownerOrgNodeId: "org-1",
    namespaceIds: [],
    auditOnAccess: true,
    allowedOrgNodeIds: [],
    fieldAllowlist: [],
    ...overrides,
    classificationRules: overrides.classificationRules ?? [],
    sharePolicy: overrides.sharePolicy ?? {
      mode: "explicit_grant",
      allowCrossTenant: false,
      requireAudit: true,
      allowOrgNodeIds: [],
    },
  };
}

function mockGrant(overrides: Partial<KnowledgeShareGrant> = {}): KnowledgeShareGrant {
  return {
    grantId: "grant-1",
    boundaryId: "boundary-1",
    requesterOrgNodeId: "org-2",
    purpose: "collaboration",
    expiresAt: "2030-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("ChineseWallAccessSaga + KnowledgeBoundaryService integration: access decision respects chinese wall policy", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ ownerOrgNodeId: "org-1" });

  const policy: ChineseWallPolicy = {
    policyId: "wall-1",
    conflictGroups: {},
    blockedOrgNodeIds: ["org-2"],
  };

  // Org-2 is blocked by chinese wall - access should be denied
  const decision = service.evaluateAccess(
    boundary,
    "user-1",
    "org-2",
    "view",
    [],
    policy,
  );

  assert.strictEqual(decision.allowed, false, "Access should be denied for blocked org");
  // Chinese wall returns: ["knowledge_boundary.chinese_wall_blocked", "knowledge_boundary.blocked_org_node"]
  assert.ok(decision.violationCodes?.some(c => c.includes("chinese_wall_blocked") || c.includes("blocked_org_node")),
    `Expected chinese wall related violation code, got: ${JSON.stringify(decision.violationCodes)}`);
});

test("ChineseWallAccessSaga grants access when org not blocked and grant exists", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ ownerOrgNodeId: "org-1" });
  // requesterOrgNodeId: org-2, which matches grant's requesterOrgNodeId
  const grant = mockGrant({ boundaryId: "boundary-1", requesterOrgNodeId: "org-2" });

  const decision = service.evaluateAccess(
    boundary,
    "user-1",
    "org-2",
    "collaboration",
    [grant],
  );

  assert.strictEqual(decision.allowed, true, "Access should be allowed with grant");
  assert.strictEqual(decision.boundaryId, "boundary-1");
});

test("ChineseWallAccessSaga execute grant lifecycle", () => {
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (step, _ctx) => {
      assert.strictEqual(step.action, "prepare_grant");
      assert.strictEqual(step.succeeded, true);
    },
    commitGrant: (step, _ctx) => {
      assert.strictEqual(step.action, "commit_grant");
      assert.strictEqual(step.succeeded, true);
    },
    audit: (step, _ctx) => {
      assert.strictEqual(step.action, "audit");
    },
  });

  const steps: ChineseWallAccessStep[] = [
    { stepId: "prepare_step_1", action: "prepare_grant", succeeded: true },
    { stepId: "commit_step_1", action: "commit_grant", succeeded: true },
    { stepId: "audit_step_1", action: "audit", succeeded: true },
  ];

  const receipt = saga.execute("access-1", steps);

  assert.strictEqual(receipt.status, "committed");
  assert.ok(receipt.committedActions.includes("commit_grant"));
  assert.strictEqual(receipt.rollbackRequired, false);
  assert.strictEqual(receipt.failedAction, null);
});

test("ChineseWallAccessSaga rollback when commit fails", () => {
  const saga = new ChineseWallAccessSaga({
    prepareGrant: (step, _ctx) => {
      // preparation succeeds
    },
    commitGrant: (step, _ctx) => {
      // commit fails
    },
  });

  const steps: ChineseWallAccessStep[] = [
    { stepId: "prepare_step_fail", action: "prepare_grant", succeeded: true },
    { stepId: "commit_step_fail", action: "commit_grant", succeeded: false },
  ];

  const receipt = saga.execute("access-2", steps);

  assert.strictEqual(receipt.status, "rolled_back");
  assert.strictEqual(receipt.failedAction, "commit_grant");
  assert.strictEqual(receipt.rollbackRequired, true);
  // committedActions is empty because commit_grant failed before being added
  assert.deepStrictEqual(receipt.committedActions, []);
});

test("KnowledgeBoundaryService + ChineseWallAccessSaga: dynamic policy evaluation", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({
    boundaryId: "boundary-dynamic-1",
    ownerOrgNodeId: "org-1",
  });

  const decision = service.evaluateDynamicAccess({
    boundary,
    requesterId: "user-1",
    requesterOrgNodeId: "org-3",
    purpose: "analytics",
    grants: [],
    dynamicPolicy: {
      policyId: "dynamic-iso-1",
      blockedRequesterIds: ["blocked-user-1"],
      deniedPurposes: ["export"],
      requiredGrantBoundaryIds: ["boundary-dynamic-1"],
    },
  });

  // dynamic policy requires grant for boundary-dynamic-1 but no grants provided
  // so access should be denied or flagged
  assert.ok(decision.allowed === false || decision.dynamicPolicyApplied === true);
});

test("KnowledgeBoundaryService stores access log after evaluation", () => {
  const service = new KnowledgeBoundaryService();
  const boundary = mockBoundary({ boundaryId: "log-boundary-1", ownerOrgNodeId: "org-1" });

  service.evaluateAccess(
    boundary,
    "log-user-1",
    "org-2",
    "view",
    [],
  );

  // Access log should be recorded under boundaryId key
  const logs = service["accessLogs"].get("log-boundary-1");
  assert.ok(logs !== undefined, "Access log should be recorded");
  assert.ok(logs.length > 0, "Should have at least one log entry");
});
