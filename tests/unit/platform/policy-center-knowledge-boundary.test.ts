import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  resolveKnowledgeClassificationRules,
  resolveKnowledgeSharePolicy,
  type KnowledgeBoundary,
  type KnowledgeBoundaryInput,
} from "../../../src/org-governance/knowledge-boundary/boundary-manager/index.js";
import { evaluateChineseWallPolicy } from "../../../src/org-governance/knowledge-boundary/chinese-wall-policy.js";
import { KnowledgeFederator } from "../../../src/org-governance/knowledge-boundary/knowledge-federator.js";
import {
  OrgNodeSchema,
  type ApprovalLimitMatrix,
  type CompliancePolicyBinding,
  type OrgHierarchySnapshot,
  toDocumentedOrgNodeType,
} from "../../../src/org-governance/org-model/org-node/index.js";
import {
  ApprovalService,
} from "../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { OPERATIONS_RUNBOOK_CATALOG } from "../../../src/platform/five-plane-control-plane/incident-control/operations-governance-service.js";
import {
  TENANT_ISOLATION_DDL,
  TenantExecutionIsolationService,
} from "../../../src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.js";
import { PolicyCenterService } from "../../../src/platform/five-plane-control-plane/policy-center/index.js";
import { HITLExplainabilityService } from "../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { HitlApprovalOrchestrationService } from "../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

function createHarness(prefix: string) {
  const tmpDir = join("/tmp", `${prefix}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  const dbPath = join(tmpDir, "test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(TENANT_ISOLATION_DDL);
  const store = new AuthoritativeTaskStore(db);
  return { tmpDir, db, store };
}

function cleanupHarness(harness: { tmpDir: string; db: SqliteDatabase }) {
  harness.db.close();
  rmSync(harness.tmpDir, { recursive: true, force: true });
}

function createTask(store: AuthoritativeTaskStore, taskId: string, now: string): void {
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general-ops",
    tenantId: null,
    title: "Reaudit task",
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("R27-37 policy center accepts canonical runtime modes and preserves governance constraints", () => {
  const service = new PolicyCenterService();

  const noExternal = service.evaluate({
    decisionId: "decision-1",
    taskId: "task-1",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "invoke_model",
    riskCategory: "cost_sensitive",
    mode: "no-external-call",
    stage: "execute",
  });
  assert.equal(noExternal.decision, "deny");
  assert.equal(noExternal.reasonCode, "policy.no_external_call_mode_denied");

  const noRollout = service.evaluate({
    decisionId: "decision-2",
    taskId: "task-2",
    subjectType: "agent",
    subjectId: "agent-1",
    action: "advance_rollout",
    riskCategory: "governance_sensitive",
    mode: "no-rollout",
    stage: "release",
  });
  assert.equal(noRollout.reasonCode, "policy.no_rollout_mode_denied");
  assert.equal(PolicyCenterService.toUnifiedRuntimeMode("manual-only"), "manual_only");
});

test("R27-38 knowledge boundary exposes classification rules and share policy", () => {
  const boundary = {
    boundaryId: "boundary-1",
    tenantId: "tenant-1",
    ownerOrgNodeId: "org-owner",
    namespaceIds: ["finance"],
    classificationRules: [{
      ruleId: "rule-1",
      matchType: "tag",
      pattern: "confidential",
      classification: "restricted",
    }],
    sharePolicy: {
      mode: "org_allowlist",
      allowCrossTenant: false,
      requireAudit: true,
      allowOrgNodeIds: ["org-partner"],
    },
  } satisfies KnowledgeBoundaryInput;

  assert.equal(resolveKnowledgeClassificationRules(boundary)[0]?.classification, "restricted");
  assert.equal(resolveKnowledgeSharePolicy(boundary).mode, "org_allowlist");
});

test("R27-39/R27-40 federated search returns canonical aggregate result and ChineseWallConstraint", () => {
  const boundaryA: KnowledgeBoundary = {
    boundaryId: "boundary-a",
    tenantId: "tenant-1",
    ownerOrgNodeId: "org-a",
    namespaceIds: ["finance"],
    allowedOrgNodeIds: ["org-searcher"],
    fieldAllowlist: ["title"],
  };
  const boundaryB: KnowledgeBoundary = {
    boundaryId: "boundary-b",
    tenantId: "tenant-1",
    ownerOrgNodeId: "org-b",
    namespaceIds: ["legal"],
    allowedOrgNodeIds: ["org-searcher"],
  };
  const federator = new KnowledgeFederator();
  const result = federator.searchFederated(
    [
      {
        sourceId: "source-a",
        boundaryId: "boundary-a",
        tenantId: "tenant-1",
        orgNodeId: "org-a",
        title: "finance update",
        content: "confidential quarterly numbers",
        tags: ["finance"],
      },
      {
        sourceId: "source-b",
        boundaryId: "boundary-b",
        tenantId: "tenant-1",
        orgNodeId: "org-b",
        title: "legal update",
        content: "legal hold",
        tags: ["legal"],
      },
    ],
    [boundaryA, boundaryB],
    {
      requester: "user-1",
      requesterTenantId: "tenant-1",
      harnessRunId: "harness-1",
      nodeRunId: "node-1",
      requesterOrgNodeId: "org-searcher",
      query: "update",
      allowedBoundaries: ["boundary-a", "boundary-b"],
      purpose: "analysis",
      maxSources: 5,
    },
    {
      policyId: "cw-1",
      conflictGroups: {
        legal_vs_searcher: ["org-searcher", "org-b"],
      },
    },
  );

  assert.equal(result.matchedSources.length, 1);
  assert.equal(result.matchedSources[0]?.boundaryId, "boundary-a");
  assert.equal(result.deniedBoundaries.includes("boundary-b"), true);
  assert.equal(result.auditRef, "federated_search:harness-1:node-1");

  const chineseWallDecision = evaluateChineseWallPolicy(
    {
      policyId: "cw-1",
      conflictGroups: {
        legal_vs_searcher: ["org-searcher", "org-b"],
      },
    },
    "org-searcher",
    "org-b",
  );
  assert.equal(chineseWallDecision.allowed, false);
  assert.equal(chineseWallDecision.constraint?.blockedGroupId, "legal_vs_searcher");
});

test("R27-41/R27-42 org node accepts canonical aliases and carries effective policies and status", () => {
  const node = OrgNodeSchema.parse({
    orgNodeId: "node-1",
    nodeType: "enterprise",
    displayName: "Acme",
    active: true,
    effectivePolicies: {
      approval: "strict",
    },
    status: "active",
  });

  assert.equal(node.nodeType, "company");
  assert.equal(node.canonicalNodeType, "enterprise");
  assert.equal(toDocumentedOrgNodeType(node.nodeType), "enterprise");
  assert.equal(node.effectivePolicies.approval, "strict");
  assert.equal(node.status, "active");
});

test("R27-43 org hierarchy canonical snapshot types are available", () => {
  const matrix: ApprovalLimitMatrix = {
    matrixId: "matrix-1",
    orgNodeId: "node-1",
    rules: [{
      ruleId: "rule-1",
      riskLevel: "high",
      maxAmountUsd: 5000,
      approverRoles: ["finance_manager"],
    }],
  };
  const binding: CompliancePolicyBinding = {
    bindingId: "binding-1",
    orgNodeId: "node-1",
    policyRef: "policy.sox",
    enforcementMode: "inherit",
  };
  const snapshot: OrgHierarchySnapshot = {
    snapshotId: "snapshot-1",
    capturedAt: "2026-05-11T00:00:00.000Z",
    nodes: [OrgNodeSchema.parse({
      orgNodeId: "node-1",
      nodeType: "business_unit",
      displayName: "BU 1",
      active: true,
    })],
    approvalLimitMatrices: [matrix],
    compliancePolicyBindings: [binding],
  };

  assert.equal(snapshot.nodes[0]?.canonicalNodeType, "business_unit");
  assert.equal(snapshot.approvalLimitMatrices[0]?.rules.length, 1);
  assert.equal(snapshot.compliancePolicyBindings[0]?.policyRef, "policy.sox");
});

test("R27-44 HITL approval feedback link includes canonical contract aliases", async () => {
  const harness = createHarness("reaudit-r27-44");
  try {
    const now = "2026-05-11T00:00:00.000Z";
    createTask(harness.store, "task-r27-44", now);
    const approvalService = new ApprovalService(harness.db, harness.store);
    const explainabilityService = new HITLExplainabilityService(harness.store);
    const orchestration = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await orchestration.requestApproval({
      taskId: "task-r27-44",
      sourceAgentId: "agent-1",
      title: "Need approval",
      reason: "Governance-sensitive action",
      riskLevel: "high",
      stageRef: "improve",
      loopIteration: 3,
      refId: "artifact-1",
      options: [{
        optionId: "approve_candidate",
        label: "Approve",
        style: "primary",
        requiresConfirm: true,
      }],
      timeoutPolicy: "remain_pending",
    });

    assert.equal(packet.feedbackLink.loop_iteration, 3);
    assert.equal(packet.feedbackLink.ref_id, "artifact-1");
    assert.equal(packet.feedbackLink.feedback_signal_id, null);

    const applied = orchestration.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "user-1",
      respondedAt: "2026-05-11T00:01:00.000Z",
    });
    assert.equal(typeof applied.feedbackLink.feedback_signal_id, "string");
  } finally {
    cleanupHarness(harness);
  }
});

test("R27-45 operations runbook catalog includes OAPEFLIR stall and rollout rollback entries", () => {
  const runbookIds = new Set(OPERATIONS_RUNBOOK_CATALOG.map((runbook) => runbook.runbookId));
  assert.equal(runbookIds.has("oapeflir_loop_stalled"), true);
  assert.equal(runbookIds.has("rollout_blocked_or_rollback"), true);
});

test("R27-46 tenant isolation auto-triggers when failure rate exceeds 30 percent with minimum sample size", () => {
  const harness = createHarness("reaudit-r27-46");
  try {
    const service = new TenantExecutionIsolationService(harness.db, {
      failureWindowSeconds: 3600,
      failureRateThreshold: 0.30,
      minSampleSize: 20,
    });
    const occurredAt = new Date().toISOString();

    for (let index = 0; index < 20; index += 1) {
      service.recordExecutionOutcome({
        executionId: `exec-${index}`,
        tenantId: "tenant-1",
        succeeded: index >= 7,
        failureCode: index < 7 ? "worker_failure" : null,
        occurredAt,
      });
    }

    const decision = service.evaluateAutomaticIsolationTrigger("tenant-1");
    const status = service.getIsolationStatus("tenant-1");
    assert.equal(decision.triggered, true);
    assert.equal(decision.sampleCount, 20);
    assert.equal(decision.failureRate > 0.30, true);
    assert.equal(status.overallStatus, "noisy_neighbor_detected");
  } finally {
    cleanupHarness(harness);
  }
});
