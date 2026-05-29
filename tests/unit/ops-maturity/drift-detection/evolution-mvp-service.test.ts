import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { EvolutionMvpService } from "../../../../src/ops-maturity/drift-detection/evolution-mvp-service.js";
import { ExperienceCacheService } from "../../../../src/platform/five-plane-state-evidence/memory/experience-cache-service.js";
import { MemoryService } from "../../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60 * 1000).toISOString();
}

test("EvolutionMvpService applies approved budget adjustment proposals and resolves effective policy", () => {
  const workspace = createTempWorkspace("aa-evolution-budget-");
  const dbPath = join(workspace, "evolution-budget.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    const memoryService = new MemoryService(store);
    const evolution = new EvolutionMvpService(db, store, approvalService, memoryService);

    seedTaskAndExecution(db, store, {
      taskId: "task-evo-budget",
      executionId: "exec-evo-budget",
    });

    const proposed = evolution.proposeBudgetAdjustment({
      taskId: "task-evo-budget",
      executionId: "exec-evo-budget",
      sourceAgentId: "supervisor-1",
      scopeType: "role",
      scopeRef: "general_ops.general_executor",
      currentPolicy: {
        maxTaskCostUsd: 5,
        maxDailyCostUsd: 50,
        maxMonthlyCostUsd: 500,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      observedAverageCostUsd: 6.2,
      sampleSize: 6,
      successRate: 0.83,
      proposalReason: "observed repeated near-limit successful runs",
    });

    assert.equal(proposed.proposal.status, "pending_approval");
    assert.ok(proposed.approval != null);
    const respondedAt = addMinutes(proposed.proposal.createdAt, 1);
    const appliedAt = addMinutes(proposed.proposal.createdAt, 2);

    approvalService.applyDecision({
      approvalId: proposed.approval!.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt,
    });

    const applied = evolution.applyProposal({
      proposalId: proposed.proposal.id,
      appliedBy: "operator-1",
      appliedAt,
    });

    assert.equal(applied.proposal.status, "applied");
    assert.equal(applied.activePolicy?.status, "active");

    const resolved = evolution.resolveBudgetPolicy(
      {
        maxTaskCostUsd: 5,
        maxDailyCostUsd: 50,
        maxMonthlyCostUsd: 500,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      "role",
      "general_ops.general_executor",
    );

    assert.ok(resolved.sourceProposalId);
    assert.ok(resolved.policy.maxTaskCostUsd > 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EvolutionMvpService promotes experience into memory and supports rollback", () => {
  const workspace = createTempWorkspace("aa-evolution-experience-");
  const dbPath = join(workspace, "evolution-experience.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    const memoryService = new MemoryService(store);
    const evolution = new EvolutionMvpService(db, store, approvalService, memoryService);
    const experiences = new ExperienceCacheService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-evo-exp",
      executionId: "exec-evo-exp",
    });

    experiences.recordExperience({
      taskId: "task-exp-source",
      sessionId: "session-exp-source",
      agentId: "agent-exp",
      executionId: "exec-exp-source",
      taskContext: "stabilize rollback and queue recovery path",
      taskIntent: "prepare rollback evidence package",
      toolsUsed: [
        { toolName: "read", callId: "call-1", status: "succeeded", durationMs: 20 },
        { toolName: "question", callId: "call-2", status: "succeeded", durationMs: 15 },
      ],
      outcome: "succeeded",
      finalErrorCode: null,
      qualityScore: 0.92,
    });

    const proposed = evolution.proposeExperiencePromotion({
      taskId: "task-evo-exp",
      executionId: "exec-evo-exp",
      sourceAgentId: "supervisor-1",
      scopeType: "division",
      scopeRef: "general_ops",
      targetScope: "project",
      taskContext: "stabilize rollback and queue recovery path",
      taskIntent: "prepare rollback evidence package",
      queryTools: ["read", "question"],
    });
    const respondedAt = addMinutes(proposed.proposal.createdAt, 1);
    const appliedAt = addMinutes(proposed.proposal.createdAt, 2);
    const recallAt = addMinutes(proposed.proposal.createdAt, 3);
    const rollbackAt = addMinutes(proposed.proposal.createdAt, 4);
    const recallAfterRollbackAt = addMinutes(proposed.proposal.createdAt, 5);

    approvalService.applyDecision({
      approvalId: proposed.approval!.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "approve",
      respondedBy: "operator-2",
      respondedAt,
    });

    const applied = evolution.applyProposal({
      proposalId: proposed.proposal.id,
      appliedBy: "operator-2",
      appliedAt,
    });

    const policyValue = JSON.parse(applied.activePolicy!.valueJson) as { memoryId?: string };
    assert.ok(policyValue.memoryId);

    const recalled = memoryService.recall({
      scopes: ["project"],
      classifications: ["experience"],
      memoryLayers: ["layer_5"],
      evaluatedAt: recallAt,
    });
    assert.equal(recalled.length, 1);

    const rolledBack = evolution.rollbackProposal({
      proposalId: proposed.proposal.id,
      rolledBackBy: "operator-2",
      reasonCode: "operator.undo",
      rolledBackAt: rollbackAt,
    });

    assert.equal(rolledBack.proposal.status, "rolled_back");

    const recalledAfterRollback = memoryService.recall({
      scopes: ["project"],
      classifications: ["experience"],
      memoryLayers: ["layer_5"],
      evaluatedAt: recallAfterRollbackAt,
    });
    assert.equal(recalledAfterRollback.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
