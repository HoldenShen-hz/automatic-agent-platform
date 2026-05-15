/**
 * E2E Drift Detection Tests
 *
 * End-to-end tests covering drift signal detection and response
 * for agent behavior drift management.
 *
 * Tests verify:
 * - Budget adjustment proposals based on observed spending
 * - Experience promotion proposals for successful outcomes
 * - Proposal approval workflow
 * - Proposal application and rollback
 * - Budget policy resolution
 * - Evolution policy lifecycle
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { EvolutionMvpService } from "../../src/ops-maturity/drift-detection/evolution-mvp-service.js";
import { ApprovalService } from "../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { MemoryService } from "../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { BudgetPolicy } from "../../src/platform/model-gateway/cost-tracker/budget-guard.js";

// ---------------------------------------------------------------------------
// Helper: Create mock ApprovalService for testing
// ---------------------------------------------------------------------------

function createMockApprovalService(harness: ReturnType<typeof createE2EHarness>) {
  // Use real ApprovalService with the harness's db and store
  return new ApprovalService(harness.db, harness.store);
}

// ---------------------------------------------------------------------------
// Test 1: Budget Adjustment Proposal Creation
// ---------------------------------------------------------------------------

test("E2E Drift Detection: creates budget adjustment proposal based on observed spending", async () => {
  const harness = createE2EHarness("aa-e2e-drift-budget-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Budget proposal test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.15,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    const result = service.proposeBudgetAdjustment({
      taskId,
      executionId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.18,
      sampleSize: 10,
      successRate: 0.9,
      proposalReason: "Observed spending exceeds budget limit",
    });

    // Verify proposal created
    assert.ok(result.proposal, "Should have proposal");
    assert.equal(result.proposal.kind, "budget_adjustment", "Should be budget adjustment");
    assert.equal(result.proposal.status, "pending_approval", "Should be pending approval");
    assert.ok(result.proposal.approvalId, "Should have approval ID");
    assert.ok(result.proposal.summary, "Should have summary");

    // Verify proposal contains evidence
    const evidence = JSON.parse(result.proposal.evidenceJson);
    assert.equal(evidence.observedAverageCostUsd, 0.18, "Evidence should contain observed cost");
    assert.equal(evidence.sampleSize, 10, "Evidence should contain sample size");

    // Verify approval was created
    assert.ok(result.approval, "Should have approval");
    assert.equal(result.approval.status, "pending", "Approval should be pending");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 2: Experience Promotion Proposal
// ---------------------------------------------------------------------------

test("E2E Drift Detection: creates experience promotion proposal for successful task", async () => {
  const harness = createE2EHarness("aa-e2e-drift-experience-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const executionId = newId("exec");
    const now = nowIso();

    // Setup task with successful execution
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Experience promotion test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.04,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    // Create experience in memory service first
    memoryService.remember({
      taskId,
      executionId,
      agentId: "agent-general",
      scope: "domain:coding",
      classification: "experience",
      memoryLayer: "layer_5",
      sourceTrustLevel: "trusted",
      qualityScore: 0.85,
      content: {
        workContext: "Successfully completed complex refactoring task",
        topOfMind: ["Refactored legacy code", "Improved performance"],
        longTermBackground: ["Python", "Microservices"],
        facts: [
          { content: "refactoring", category: "skill", confidence: 0.9, provenanceSource: `task:${taskId}` },
        ],
      },
      createdAt: now,
    });

// @ts-ignore
    const result = service.proposeExperiencePromotion({
      taskId,
      executionId,
      sourceAgentId: "agent-general",
      scopeType: "role",
      scopeRef: "general_ops:coding",
      taskContext: "Successfully completed complex refactoring task",
      taskIntent: "refactoring",
      minQualityScore: 0.65,
    });

    // Verify proposal created
    assert.ok(result.proposal, "Should have proposal");
    assert.equal(result.proposal.kind, "experience_promotion", "Should be experience promotion");
    assert.equal(result.proposal.status, "pending_approval", "Should be pending approval");

    // Verify proposal contains experience details
    const payload = JSON.parse(result.proposal.proposalJson);
    assert.ok(payload.promotedSummary, "Should have promoted summary");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Proposal Approval Workflow
// ---------------------------------------------------------------------------

test("E2E Drift Detection: proposal approval workflow transitions correctly", async () => {
  const harness = createE2EHarness("aa-e2e-drift-approval-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Approval workflow test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.10,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create proposal
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.15,
      sampleSize: 5,
      successRate: 0.85,
      proposalReason: "Slight overspend observed",
    });

    assert.equal(proposalResult.proposal.status, "pending_approval", "Should start pending");

    // Approve the proposal
    approvalService.resolve({
      approvalId: proposalResult.proposal.approvalId!,
      decision: "approved",
      resolvedBy: "manager-001",
    });

    // Sync proposal status
    const synced = service.syncProposalApprovalStatus(proposalResult.proposal.id);

    // Verify status transitioned
    assert.equal(synced.status, "approved", "Should be approved after sync");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 4: Proposal Application
// ---------------------------------------------------------------------------

test("E2E Drift Detection: approved proposal is applied correctly", async () => {
  const harness = createE2EHarness("aa-e2e-drift-apply-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Apply test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.12,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create and approve proposal
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.15,
      sampleSize: 8,
      successRate: 0.88,
      proposalReason: "Need higher task budget",
    });

    harness.db.transaction(() => {
      const approval = harness.store.approval.getApproval(proposalResult.proposal.approvalId!);
      if (approval) {
        harness.store.approval.updateApprovalRequest({
          id: approval.id,
          requestJson: JSON.stringify({
            ...JSON.parse(approval.requestJson),
            status: "approved",
          }),
        });
      }
    });
    service.syncProposalApprovalStatus(proposalResult.proposal.id);

    // Apply proposal
    const applied = service.applyProposal({
      proposalId: proposalResult.proposal.id,
      appliedBy: "manager-001",
    });

    // Verify applied
    assert.equal(applied.proposal.status, "applied", "Should be applied");
    assert.ok(applied.proposal.appliedAt, "Should have appliedAt timestamp");
    assert.ok(applied.activePolicy, "Should have active policy");

    // Verify active policy contains new budget
    const policyValue = JSON.parse(applied.activePolicy!.valueJson);
    assert.ok(policyValue.recommendedPolicy, "Should have recommended policy");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 5: Proposal Rollback
// ---------------------------------------------------------------------------

test("E2E Drift Detection: applied proposal can be rolled back", async () => {
  const harness = createE2EHarness("aa-e2e-drift-rollback-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Rollback test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.12,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create, approve, and apply proposal
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.15,
      sampleSize: 8,
      successRate: 0.88,
      proposalReason: "Test rollback",
    });

    harness.db.transaction(() => {
      const approval = harness.store.approval.getApproval(proposalResult.proposal.approvalId!);
      if (approval) {
        harness.store.approval.updateApprovalRequest({
          id: approval.id,
          requestJson: JSON.stringify({
            ...JSON.parse(approval.requestJson),
            status: "approved",
          }),
        });
      }
    });
    service.syncProposalApprovalStatus(proposalResult.proposal.id);
    service.applyProposal({ proposalId: proposalResult.proposal.id, appliedBy: "manager-001" });

    // Rollback proposal
    const rolledBack = service.rollbackProposal({
      proposalId: proposalResult.proposal.id,
      rolledBackBy: "admin-001",
      reasonCode: "policy_not_working_as_expected",
    });

    // Verify rolled back
    assert.equal(rolledBack.proposal.status, "rolled_back", "Should be rolled back");
    assert.ok(rolledBack.proposal.rolledBackAt, "Should have rolledBackAt");

    // Verify active policy is no longer active
    const rolledBackPolicy = harness.store.evolution.getEvolutionPolicyByProposal(proposalResult.proposal.id);
    assert.ok(rolledBackPolicy, "Policy should still exist");
    assert.equal(rolledBackPolicy!.status, "rolled_back", "Policy should be rolled back");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 6: Budget Policy Resolution
// ---------------------------------------------------------------------------

test("E2E Drift Detection: resolves budget policy with active evolution policy", async () => {
  const harness = createE2EHarness("aa-e2e-drift-resolve-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Resolve test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.12,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create, approve, and apply a policy change
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.18,
      sampleSize: 12,
      successRate: 0.92,
      proposalReason: "Increase task budget",
    });

    harness.db.transaction(() => {
      const approval = harness.store.approval.getApproval(proposalResult.proposal.approvalId!);
      if (approval) {
        harness.store.approval.updateApprovalRequest({
          id: approval.id,
          requestJson: JSON.stringify({
            ...JSON.parse(approval.requestJson),
            status: "approved",
          }),
        });
      }
    });
    service.syncProposalApprovalStatus(proposalResult.proposal.id);
    service.applyProposal({ proposalId: proposalResult.proposal.id, appliedBy: "manager-001" });

    // Resolve budget policy
    const resolved = service.resolveBudgetPolicy(basePolicy, "division", "general_ops");

    // Verify resolved with new policy
    assert.ok(resolved.policy, "Should have resolved policy");
    assert.ok(resolved.sourceProposalId, "Should reference source proposal");
    assert.notEqual(resolved.policy.maxTaskCostUsd, basePolicy.maxTaskCostUsd, "Should have different max task cost");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 7: Proposal Rejection
// ---------------------------------------------------------------------------

test("E2E Drift Detection: rejected proposal does not apply", async () => {
  const harness = createE2EHarness("aa-e2e-drift-reject-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Reject test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.12,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create and reject proposal
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.15,
      sampleSize: 5,
      successRate: 0.85,
      proposalReason: "Test rejection",
    });

    // Reject the proposal
    approvalService.resolve({
      approvalId: proposalResult.proposal.approvalId!,
      decision: "rejected",
      resolvedBy: "manager-001",
    });
    const synced = service.syncProposalApprovalStatus(proposalResult.proposal.id);

    // Verify rejected
    assert.equal(synced.status, "rejected", "Should be rejected");

    // Try to apply rejected proposal - should throw
    assert.throws(
      () => service.applyProposal({ proposalId: proposalResult.proposal.id, appliedBy: "manager-001" }),
      /evolution\.approval_required/,
      "Should throw when applying rejected proposal"
    );

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 8: Evolution Logs
// ---------------------------------------------------------------------------

test("E2E Drift Detection: evolution logs track proposal lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-drift-logs-");
  try {
    const approvalService = createMockApprovalService(harness);
    const memoryService = new MemoryService(harness.store);
    const service = new EvolutionMvpService(harness.db, harness.store, approvalService, memoryService);

    const taskId = newId("task");
    const now = nowIso();

    // Setup task
    harness.db.transaction(() => {
      harness.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Logs test",
        status: "done",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: '{"result": "success"}',
        estimatedCostUsd: 0.05,
        actualCostUsd: 0.12,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
      });
    });

    const basePolicy: BudgetPolicy = {
      maxTaskCostUsd: 0.10,
      maxPackCostUsd: 1.0,
      maxPlatformCostUsd: 100.0,
      maxDailyCostUsd: 10,
      maxMonthlyCostUsd: 100,
      maxModelTokens: 10000,
      maxSteps: 100,
      maxDurationMs: 60000,
      warnAtRatio: 0.8,
      mode: "supervised",
    };

    // Create proposal
    const proposalResult = service.proposeBudgetAdjustment({
      taskId,
      sourceAgentId: "agent-general",
      scopeType: "division",
      scopeRef: "general_ops",
      currentPolicy: basePolicy,
      observedAverageCostUsd: 0.15,
      sampleSize: 5,
      successRate: 0.85,
      proposalReason: "Log test",
    });

    // Verify logs exist
    assert.ok(proposalResult.logs.length > 0, "Should have logs");
    const creationLog = proposalResult.logs.find((l: { eventType: string }) => l.eventType === "proposal_created");
    assert.ok(creationLog, "Should have proposal_created log");
    assert.equal(creationLog!.reasonCode, "evolution.proposal_created", "Should have correct reason code");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of E2E Drift Detection Tests
// ---------------------------------------------------------------------------
