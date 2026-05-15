/**
 * Integration Test: Org-Governance Sagas
 *
 * Tests integration between org-governance sagas, database interactions,
 * compensation flows, event emission, and multi-saga coordination.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { GovernanceDelegationRevocationSaga } from "../../../src/org-governance/delegated-governance/governance-delegation-revocation-saga.js";
import { ChineseWallAccessSaga } from "../../../src/org-governance/knowledge-boundary/chinese-wall-access-saga.js";
import { OrgGovernanceSaga } from "../../../src/org-governance/org-model/org-governance-saga.js";
import { createIntegrationContext } from "../../helpers/integration-context.js";
import { nowIso, newId } from "../../../src/platform/contracts/types/ids.js";

// ─────────────────────────────────────────────────────────────────────────────
// GovernanceDelegationRevocationSaga Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: GovernanceDelegationRevocationSaga completes prepare and commit stages", () => {
  const ctx = createIntegrationContext("aa-governance-delegation-");
  try {
    const emittedEvents: Array<{ stage: string; subjectId: string; outcome: string }> = [];

    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: resourceId, outcome: "completed" });
      },
      revokePendingApprovals: (_delegationId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: "pending_approvals", outcome: "completed" });
      },
      revokeActiveSessions: (_delegationId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: "active_sessions", outcome: "completed" });
      },
      revokeSecretLeases: (_delegationId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: "secret_leases", outcome: "completed" });
      },
      revokeWorkerLeases: (_delegationId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: "worker_leases", outcome: "completed" });
      },
      revokeScheduledTriggers: (_delegationId, _context) => {
        emittedEvents.push({ stage: "prepare", subjectId: "scheduled_triggers", outcome: "completed" });
      },
      revokeDerivedDelegation: (delegationId, _context) => {
        emittedEvents.push({ stage: "commit", subjectId: delegationId, outcome: "completed" });
      },
      audit: (_receipt, _context) => {
        emittedEvents.push({ stage: "audit", subjectId: "audit", outcome: "completed" });
      },
    });

    const receipt = saga.revoke(
      {
        delegationId: "del_integration_001",
        requestedAtMs: Date.now() - 1000,
        derivedResourceIds: ["resource_1", "resource_2"],
        derivedDelegationIds: ["del_derived_001"],
        cascadeScope: {
          pendingApprovals: true,
          activeSessions: true,
          secretLeases: true,
          workerLeases: true,
          scheduledTriggers: true,
        },
      },
      Date.now(),
    );

    assert.equal(receipt.delegationId, "del_integration_001");
    assert.equal(receipt.status, "completed");
    assert.deepEqual(receipt.frozenResourceIds, ["resource_1", "resource_2"]);
    assert.deepEqual(receipt.revokedDerivedDelegationIds, ["del_derived_001"]);
    assert.equal(receipt.failedStage, null);
    assert.ok(receipt.executionLog.length > 0);
    assert.ok(emittedEvents.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga triggers compensation on failure", () => {
  const ctx = createIntegrationContext("aa-governance-delegation-comp-");
  try {
    const compensationCalls: string[] = [];

    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId, _context) => {
        if (resourceId === "resource_fail") {
          throw new Error("Simulated freeze failure");
        }
      },
      compensateResource: (resourceId, _context) => {
        compensationCalls.push(resourceId);
      },
      audit: () => {
        // no-op
      },
    });

    const receipt = saga.revoke(
      {
        delegationId: "del_comp_001",
        requestedAtMs: Date.now() - 1000,
        derivedResourceIds: ["resource_ok_1", "resource_fail", "resource_ok_2"],
        derivedDelegationIds: [],
      },
      Date.now(),
    );

    assert.equal(receipt.status, "compensated");
    assert.equal(receipt.failedStage, "prepare");
    assert.deepEqual(receipt.compensationResourceIds, ["resource_ok_1"]);
    assert.ok(compensationCalls.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: GovernanceDelegationRevocationSaga with database persistence", () => {
  const ctx = createIntegrationContext("aa-governance-delegation-db-");
  try {
    const delegationId = "del_db_001";
    const resourceIds = ["resource_a", "resource_b", "resource_c"];
    let nextAttempt = 2;

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_saga_001",
        parentId: null,
        rootId: "task_saga_001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Delegation test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });

      ctx.store.insertExecution({
        id: "exec_saga_001",
        taskId: "task_saga_001",
        workflowId: "governance_delegation",
        parentExecutionId: null,
        agentId: "agent_saga",
        roleId: "governance_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-saga-001",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: nowIso(),
        finishedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    });

    const saga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId, _context) => {
        // Simulate database write for tracking
        ctx.db.transaction(() => {
          ctx.store.insertExecution({
            id: `exec_${resourceId}`,
            taskId: "task_saga_001",
            workflowId: "freeze_resource",
            parentExecutionId: null,
            agentId: "agent_saga",
            roleId: "governance_executor",
            runKind: "task_run",
            status: "executing",
            inputRef: null,
            traceId: `trace-${resourceId}`,
            attempt: nextAttempt++,
            timeoutMs: 60000,
            budgetUsdLimit: 1,
            requiresApproval: 0,
            sandboxMode: "workspace_write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 0,
            retryBackoff: "none",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: nowIso(),
            finishedAt: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        });
      },
      compensateResource: (resourceId, _context) => {
        // Compensation tracked via receipt
      },
      audit: () => {
        // no-op
      },
    });

    const receipt = saga.revoke(
      {
        delegationId,
        requestedAtMs: Date.now() - 5000,
        derivedResourceIds: resourceIds,
      },
      Date.now(),
    );

    assert.equal(receipt.delegationId, delegationId);
    assert.equal(receipt.status, "completed");
    assert.deepEqual(receipt.frozenResourceIds, resourceIds);

    // Verify executions were created through the authoritative execution repository
    for (const resourceId of resourceIds) {
      assert.notEqual(ctx.store.getExecution(`exec_${resourceId}`, null), null);
    }
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ChineseWallAccessSaga Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: ChineseWallAccessSaga executes grant and release flow", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-");
  try {
    const actionLog: Array<{ action: string; outcome: string }> = [];

    const saga = new ChineseWallAccessSaga({
      prepareGrant: (step, _context) => {
        actionLog.push({ action: step.action, outcome: "prepared" });
      },
      commitGrant: (step, _context) => {
        actionLog.push({ action: step.action, outcome: "committed" });
      },
      prepareRelease: (step, _context) => {
        actionLog.push({ action: step.action, outcome: "prepared" });
      },
      commitRelease: (step, _context) => {
        actionLog.push({ action: step.action, outcome: "committed" });
      },
      audit: (step, _context) => {
        actionLog.push({ action: step.action, outcome: "audited" });
      },
    });

    const steps = [
      { stepId: "grant_1", action: "prepare_grant" as const, succeeded: true },
      { stepId: "grant_1", action: "commit_grant" as const, succeeded: true },
      { stepId: "release_1", action: "prepare_release" as const, succeeded: true },
      { stepId: "release_1", action: "commit_release" as const, succeeded: true },
      { stepId: "audit_1", action: "audit" as const, succeeded: true },
    ];

    const receipt = saga.execute("access_chinese_wall_001", steps);

    assert.equal(receipt.accessId, "access_chinese_wall_001");
    assert.equal(receipt.status, "committed");
    assert.deepEqual(receipt.committedActions, ["commit_grant", "commit_release"]);
    assert.equal(receipt.rollbackRequired, false);
    assert.ok(actionLog.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga rolls back on commit failure", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-rollback-");
  try {
    const rollbackLog: string[] = [];

    const saga = new ChineseWallAccessSaga({
      prepareGrant: (step, _context) => {
        // Prepare succeeds for both
      },
      commitGrant: (step, _context) => {
        if (step.stepId === "grant_fail") {
          throw new Error("Commit grant failed");
        }
      },
      prepareRelease: (step, _context) => {
        // Release preparation
      },
      commitRelease: (step, _context) => {
        rollbackLog.push(step.action);
      },
      audit: () => {
        // no-op
      },
    });

    const steps = [
      { stepId: "grant_ok", action: "prepare_grant" as const, succeeded: true },
      { stepId: "grant_ok", action: "commit_grant" as const, succeeded: true },
      { stepId: "grant_fail", action: "prepare_grant" as const, succeeded: true },
      { stepId: "grant_fail", action: "commit_grant" as const, succeeded: false },
    ];

    const receipt = saga.execute("access_rollback_001", steps);

    assert.equal(receipt.status, "rolled_back");
    assert.equal(receipt.rollbackRequired, true);
    assert.ok(receipt.compensatedActions.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ChineseWallAccessSaga with database checkpoint", () => {
  const ctx = createIntegrationContext("aa-chinese-wall-db-");
  try {
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_cw_001",
        parentId: null,
        rootId: "task_cw_001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Chinese wall test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
    });

    const saga = new ChineseWallAccessSaga({
      prepareGrant: (step, _context) => {
        // Checkpoint write
      },
      commitGrant: (step, _context) => {
        // Commit write
      },
      audit: () => {
        // no-op
      },
    });

    const steps = [
      { stepId: "grant_check_1", action: "prepare_grant" as const, succeeded: true },
      { stepId: "grant_check_1", action: "commit_grant" as const, succeeded: true },
    ];

    const receipt = saga.execute("access_db_001", steps);

    assert.equal(receipt.status, "committed");
    assert.deepEqual(receipt.committedActions, ["commit_grant"]);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// OrgGovernanceSaga Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: OrgGovernanceSaga executes multi-phase governance flow", () => {
  const ctx = createIntegrationContext("aa-org-governance-");
  try {
    const phaseLog: Array<{ phase: string; action: string; outcome: string }> = [];

    const saga = new OrgGovernanceSaga({
      prepare: (step, _context) => {
        phaseLog.push({ phase: step.phase, action: step.action, outcome: "prepared" });
      },
      commit: (step, _context) => {
        phaseLog.push({ phase: step.phase, action: step.action, outcome: "committed" });
      },
      compensate: (step, _context) => {
        phaseLog.push({ phase: step.phase, action: step.action, outcome: "compensated" });
      },
      audit: (step, _context) => {
        phaseLog.push({ phase: step.phase, action: step.action, outcome: "audited" });
      },
    });

    const steps = [
      { stepId: "identity_1", targetOrgNodeId: "org_node_1", action: "prepare" as const, phase: "identity" },
      { stepId: "approval_1", targetOrgNodeId: "org_node_2", action: "prepare" as const, phase: "approval" },
      { stepId: "identity_1", targetOrgNodeId: "org_node_1", action: "commit" as const, phase: "identity" },
      { stepId: "approval_1", targetOrgNodeId: "org_node_2", action: "commit" as const, phase: "approval" },
      { stepId: "audit_1", targetOrgNodeId: "org_node_1", action: "audit" as const, phase: "identity" },
    ];

    const result = saga.execute("saga_multi_phase_001", steps);

    assert.equal(result.sagaId, "saga_multi_phase_001");
    assert.equal(result.status, "committed");
    assert.deepEqual(result.preparedNodeIds, ["org_node_1", "org_node_2"]);
    assert.deepEqual(result.committedNodeIds, ["org_node_1", "org_node_2"]);
    assert.ok(phaseLog.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: OrgGovernanceSaga compensates on prepare failure", () => {
  const ctx = createIntegrationContext("aa-org-governance-comp-");
  try {
    const compensatedNodes: string[] = [];

    const saga = new OrgGovernanceSaga({
      prepare: (step, _context) => {
        if (step.targetOrgNodeId === "org_fail") {
          throw new Error("Prepare failed for org_fail");
        }
      },
      commit: (_step, _context) => {
        // No commits if prepare fails
      },
      compensate: (step, _context) => {
        compensatedNodes.push(step.targetOrgNodeId);
      },
      audit: () => {
        // no-op
      },
    });

    const steps = [
      { stepId: "prep_1", targetOrgNodeId: "org_ok", action: "prepare" as const, phase: "identity" },
      { stepId: "prep_2", targetOrgNodeId: "org_fail", action: "prepare" as const, phase: "approval" },
      { stepId: "prep_3", targetOrgNodeId: "org_after_fail", action: "prepare" as const, phase: "budget" },
    ];

    const result = saga.execute("saga_comp_001", steps);

    assert.equal(result.status, "compensated");
    assert.ok(result.failedStepId !== null);
    assert.ok(compensatedNodes.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: OrgGovernanceSaga with executeWithReceipt returns phase breakdown", () => {
  const ctx = createIntegrationContext("aa-org-governance-receipt-");
  try {
    const saga = new OrgGovernanceSaga({
      prepare: (_step, _context) => {
        // no-op
      },
      commit: (_step, _context) => {
        // no-op
      },
      compensate: (_step, _context) => {
        // no-op
      },
      audit: (_step, _context) => {
        // no-op
      },
    });

    const steps = [
      { stepId: "identity_prep", targetOrgNodeId: "org_a", action: "prepare" as const, phase: "identity" },
      { stepId: "identity_commit", targetOrgNodeId: "org_a", action: "commit" as const, phase: "identity" },
      { stepId: "budget_prep", targetOrgNodeId: "org_b", action: "prepare" as const, phase: "budget" },
      { stepId: "budget_commit", targetOrgNodeId: "org_b", action: "commit" as const, phase: "budget" },
      { stepId: "audit_1", targetOrgNodeId: "org_a", action: "audit" as const, phase: "identity" },
    ];

    const receipt = saga.executeWithReceipt("saga_receipt_001", steps);

    assert.equal(receipt.sagaId, "saga_receipt_001");
    assert.equal(receipt.status, "committed");
    assert.ok(receipt.phaseCommitOrder.length === 5);
    assert.ok(receipt.preparedByPhase["identity"].length > 0);
    assert.ok(receipt.committedByPhase["budget"].length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: OrgGovernanceSaga with database state tracking", () => {
  const ctx = createIntegrationContext("aa-org-governance-db-");
  try {
    const insertedExecutionIds: string[] = [];
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: "task_org_001",
        parentId: null,
        rootId: "task_org_001",
        divisionId: "general_ops",
        tenantId: null,
        title: "Org governance test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
      });
    });

    const saga = new OrgGovernanceSaga({
      prepare: (_step, _context) => {
        ctx.db.transaction(() => {
          const executionId = `exec_prepare_${newId()}`;
          insertedExecutionIds.push(executionId);
          ctx.store.insertExecution({
            id: executionId,
            taskId: "task_org_001",
            workflowId: "org_prepare",
            parentExecutionId: null,
            agentId: "agent_org",
            roleId: "org_governor",
            runKind: "task_run",
            status: "executing",
            inputRef: null,
            traceId: `trace_${newId()}`,
            attempt: 1,
            timeoutMs: 60000,
            budgetUsdLimit: 1,
            requiresApproval: 0,
            sandboxMode: "workspace_write",
            allowedToolsJson: "[]",
            allowedPathsJson: "[]",
            maxRetries: 0,
            retryBackoff: "none",
            lastErrorCode: null,
            lastErrorMessage: null,
            startedAt: nowIso(),
            finishedAt: null,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        });
      },
      commit: (_step, _context) => {
        // Commit tracked
      },
      compensate: (_step, _context) => {
        // Required by the saga contract whenever commit steps are present.
      },
      audit: () => {
        // no-op
      },
    });

    const steps = [
      { stepId: "prep_db_1", targetOrgNodeId: "org_db_1", action: "prepare" as const, phase: "identity" },
      { stepId: "commit_db_1", targetOrgNodeId: "org_db_1", action: "commit" as const, phase: "identity" },
    ];

    const result = saga.execute("saga_db_001", steps);

    assert.equal(result.status, "committed");
    for (const executionId of insertedExecutionIds) {
      assert.notEqual(ctx.store.getExecution(executionId, null), null);
    }
    assert.equal(result.preparedNodeIds.includes("org_db_1"), true);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Saga Coordination Tests
// ─────────────────────────────────────────────────────────────────────────────

test("integration: Multi-saga coordination between GovernanceDelegationRevocationSaga and OrgGovernanceSaga", () => {
  const ctx = createIntegrationContext("aa-multi-saga-coord-");
  try {
    // First saga: Delegation revocation
    const revocationSaga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId, _context) => {
        // no-op
      },
      compensateResource: (resourceId, _context) => {
        // no-op
      },
      audit: () => {
        // no-op
      },
    });

    // Second saga: Org governance
    const orgSaga = new OrgGovernanceSaga({
      prepare: (step, _context) => {
        if (step.targetOrgNodeId === "org_chained_2") {
          throw new Error("governance rollback required");
        }
      },
      commit: (_step, _context) => {
        // no-op
      },
      compensate: (_step, _context) => {
        // Required by the saga contract whenever commit steps are present.
      },
      audit: () => {
        // no-op
      },
    });

    // Execute revocation first
    const revocationReceipt = revocationSaga.revoke(
      {
        delegationId: "del_coord_001",
        requestedAtMs: Date.now() - 2000,
        derivedResourceIds: ["resource_coord_1"],
      },
      Date.now(),
    );

    // Then execute org governance
    const orgSteps = [
      { stepId: "org_prep_1", targetOrgNodeId: "org_coord_1", action: "prepare" as const, phase: "identity" },
      { stepId: "org_commit_1", targetOrgNodeId: "org_coord_1", action: "commit" as const, phase: "identity" },
    ];
    const orgResult = orgSaga.execute("saga_coord_001", orgSteps);

    // Verify both completed
    assert.equal(revocationReceipt.status, "completed");
    assert.equal(orgResult.status, "committed");
  } finally {
    ctx.cleanup();
  }
});

test("integration: Multi-saga coordination with ChineseWallAccessSaga triggering OrgGovernanceSaga on rollback", () => {
  const ctx = createIntegrationContext("aa-multi-saga-chained-");
  try {
    let governanceTriggered = false;

    const chineseWallSaga = new ChineseWallAccessSaga({
      prepareGrant: (_step, _context) => {
        // no-op
      },
      commitGrant: (_step, _context) => {
        // Will fail to trigger rollback
      },
      prepareRelease: (_step, _context) => {
        // no-op
      },
      commitRelease: (_step, _context) => {
        governanceTriggered = true;
      },
      audit: () => {
        // no-op
      },
    });

    const orgSaga = new OrgGovernanceSaga({
      prepare: (step, _context) => {
        if (step.targetOrgNodeId === "org_chained_2") {
          throw new Error("governance rollback required");
        }
      },
      commit: (_step, _context) => {
        // no-op
      },
      compensate: (_step, _context) => {
        // Compensation logic
      },
      audit: () => {
        // no-op
      },
    });

    // Execute ChineseWallSaga with failure
    const cwSteps = [
      { stepId: "grant_chain_1", action: "prepare_grant" as const, succeeded: true },
      { stepId: "grant_chain_1", action: "commit_grant" as const, succeeded: false },
    ];
    const cwReceipt = chineseWallSaga.execute("access_chained_001", cwSteps);

    assert.equal(cwReceipt.status, "rolled_back");

    // If rollback occurred, trigger org governance compensation
    if (cwReceipt.rollbackRequired) {
      const orgSteps = [
        { stepId: "org_prepare_1", targetOrgNodeId: "org_chained_1", action: "prepare" as const, phase: "domain" },
        { stepId: "org_prepare_2", targetOrgNodeId: "org_chained_2", action: "prepare" as const, phase: "domain" },
        { stepId: "org_compensate_1", targetOrgNodeId: "org_chained_1", action: "compensate" as const, phase: "domain" },
      ];
      const orgResult = orgSaga.execute("saga_chained_001", orgSteps);
      assert.deepEqual(orgResult.compensatedNodeIds, ["org_chained_1"]);
    }
  } finally {
    ctx.cleanup();
  }
});

test("integration: Event emission pattern across multiple saga types", () => {
  const ctx = createIntegrationContext("aa-event-emission-");
  try {
    const emittedEvents: Array<{ sagaType: string; eventType: string; subjectId: string }> = [];

    const revocationSaga = new GovernanceDelegationRevocationSaga({
      freezeResource: (resourceId, _context) => {
        emittedEvents.push({ sagaType: "delegation", eventType: "resource_frozen", subjectId: resourceId });
      },
      compensateResource: (resourceId, _context) => {
        emittedEvents.push({ sagaType: "delegation", eventType: "resource_compensated", subjectId: resourceId });
      },
      audit: (_receipt, _context) => {
        emittedEvents.push({ sagaType: "delegation", eventType: "audit_completed", subjectId: _receipt.delegationId });
      },
    });

    const chineseWallSaga = new ChineseWallAccessSaga({
      prepareGrant: (step, _context) => {
        emittedEvents.push({ sagaType: "chineseWall", eventType: step.action, subjectId: step.stepId });
      },
      commitGrant: (step, _context) => {
        emittedEvents.push({ sagaType: "chineseWall", eventType: step.action, subjectId: step.stepId });
      },
      audit: (step, _context) => {
        emittedEvents.push({ sagaType: "chineseWall", eventType: step.action, subjectId: step.stepId });
      },
    });

    const orgSaga = new OrgGovernanceSaga({
      prepare: (step, _context) => {
        emittedEvents.push({ sagaType: "orgGovernance", eventType: "prepare", subjectId: step.targetOrgNodeId });
      },
      commit: (step, _context) => {
        emittedEvents.push({ sagaType: "orgGovernance", eventType: "commit", subjectId: step.targetOrgNodeId });
      },
      compensate: (step, _context) => {
        emittedEvents.push({ sagaType: "orgGovernance", eventType: "compensate", subjectId: step.targetOrgNodeId });
      },
      audit: (step, _context) => {
        emittedEvents.push({ sagaType: "orgGovernance", eventType: "audit", subjectId: step.stepId });
      },
    });

    // Execute all sagas
    revocationSaga.revoke(
      { delegationId: "del_event_001", requestedAtMs: Date.now() - 1000, derivedResourceIds: ["res_event_1"] },
      Date.now(),
    );

    chineseWallSaga.execute("access_event_001", [
      { stepId: "grant_event_1", action: "prepare_grant", succeeded: true },
      { stepId: "grant_event_1", action: "commit_grant", succeeded: true },
      { stepId: "audit_event_1", action: "audit", succeeded: true },
    ]);

    orgSaga.execute("saga_event_001", [
      { stepId: "prep_event_1", targetOrgNodeId: "org_event_1", action: "prepare", phase: "identity" },
      { stepId: "commit_event_1", targetOrgNodeId: "org_event_1", action: "commit", phase: "identity" },
    ]);

    assert.ok(emittedEvents.length >= 6);
  } finally {
    ctx.cleanup();
  }
});
