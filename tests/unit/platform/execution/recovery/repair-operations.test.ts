/**
 * Unit Tests: Repair Operations
 *
 * Tests repair pipeline, validation repair loop, stalled execution detector,
 * and related repair operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RepairPipeline, DEFAULT_PIPELINE_OPTIONS, type PipelineState, type PipelineStage } from "../../../../../src/platform/five-plane-execution/recovery/repair-pipeline.js";
import { createTaskCard, type TaskCard, type TaskRiskLevel } from "../../../../../src/platform/five-plane-execution/recovery/task-card.js";
import { ValidationRepairLoopService, type ValidationLoopInput, type ValidationDecision } from "../../../../../src/platform/five-plane-execution/recovery/validation-repair-loop.js";
import { StalledExecutionDetector, type StalledExecutionDetectionOptions, type StalledExecutionFinding } from "../../../../../src/platform/five-plane-execution/recovery/stalled-execution-detector.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createTestTaskCard(riskLevel: TaskRiskLevel = "medium", maxRepairRounds = 3): TaskCard {
  return createTaskCard({
    taskId: "task-test-1",
    title: "Test Task",
    objective: "Complete test",
    riskLevel,
    maxRepairRounds,
  });
}

function createMockStore(overrides: {
  listActiveExecutionActivity?: () => Array<{
    executionId: string;
    taskId: string;
    agentId: string;
    status: string;
    updatedAt: string;
    latestHeartbeatAt: string | null;
    latestEventAt: string | null;
  }>;
} = {}): AuthoritativeTaskStore {
  return {
    operations: {
      listActiveExecutionActivity: overrides.listActiveExecutionActivity ?? (() => []),
    },
  } as unknown as AuthoritativeTaskStore;
}

// =============================================================================
// Repair Pipeline Tests
// =============================================================================

test("RepairPipeline initializes with plan stage", () => {
  const card = createTestTaskCard();
  const pipeline = new RepairPipeline(card);
  const state = pipeline.getState();
  assert.equal(state.currentStage, "plan");
  assert.equal(state.repairRound, 0);
  assert.equal(state.escalated, false);
});

test("RepairPipeline.isComplete returns false initially", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  assert.equal(pipeline.isComplete(), false);
});

test("RepairPipeline.isComplete returns true when completed", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.complete();
  assert.equal(pipeline.isComplete(), true);
});

test("RepairPipeline.isComplete returns true when failed", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.fail("test failure");
  assert.equal(pipeline.isComplete(), true);
});

test("RepairPipeline.transitionTo updates currentStage and stageHistory", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.transitionTo("build");
  const state = pipeline.getState();
  assert.equal(state.currentStage, "build");
  assert.deepEqual(state.stageHistory, ["build"]);
});

test("RepairPipeline.complete sets currentStage to completed", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.complete();
  assert.equal(pipeline.getState().currentStage, "completed");
});

test("RepairPipeline.fail sets currentStage to failed", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.fail("intentional failure");
  assert.equal(pipeline.getState().currentStage, "failed");
});

test("RepairPipeline.escalate sets escalated true and currentStage to escalated", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.escalate("test escalation");
  const state = pipeline.getState();
  assert.equal(state.escalated, true);
  assert.equal(state.currentStage, "escalated");
});

test("RepairPipeline.incrementRepairRound increments repairRound and sets stage to repair", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  pipeline.incrementRepairRound();
  const state = pipeline.getState();
  assert.equal(state.repairRound, 1);
  assert.equal(state.currentStage, "repair");
});

test("RepairPipeline.shouldRepair returns true when auto repair enabled and budget available", () => {
  const pipeline = new RepairPipeline(createTestTaskCard());
  assert.equal(pipeline.shouldRepair(), true);
});

test("RepairPipeline.shouldRepair returns false when repair budget exhausted", () => {
  const card = createTaskCard({
    taskId: "task-test-2",
    title: "Test",
    objective: "Test",
    riskLevel: "medium",
    maxRepairRounds: 0,
  });
  const pipeline = new RepairPipeline(card);
  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline.shouldRepair returns false when automatic repair disabled", () => {
  const pipeline = new RepairPipeline(createTestTaskCard(), { enableAutomaticRepair: false });
  assert.equal(pipeline.shouldRepair(), false);
});

test("RepairPipeline.shouldRepair respects maxRepairRounds option", () => {
  const pipeline = new RepairPipeline(createTestTaskCard(), { maxRepairRounds: 1 });
  pipeline.incrementRepairRound();
  assert.equal(pipeline.shouldRepair(), false);
});

test("PipelineStage type accepts all valid stages", () => {
  const stages: PipelineStage[] = [
    "plan", "build", "review", "validate", "repair",
    "re_validate", "release", "escalated", "completed", "failed",
  ];
  assert.equal(stages.length, 10);
});

// =============================================================================
// Validation Repair Loop Tests
// =============================================================================

test("ValidationRepairLoopService.buildRepairEvidencePackage creates correct package", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: false,
    validationPassed: false,
    failedChecks: [{ check: "typecheck", details: "failed" }],
    changedFiles: ["file1.ts", "file2.ts"],
    allowedFixScope: ["src/"],
    forbiddenScope: ["**/secrets/**"],
    maxDiffLines: 100,
    repairRound: 1,
    maxRepairRounds: 3,
  };

  const result = service.buildRepairEvidencePackage(input);

  assert.equal(result.taskId, "task-1");
  assert.equal(result.failedChecks.length, 1);
  assert.equal(result.changedFiles.length, 2);
  assert.equal(result.repairRound, 1);
});

test("ValidationRepairLoopService.decide returns released when review and validation passed", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: true,
    validationPassed: true,
    failedChecks: [],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 3,
  };

  const result = service.decide(input);

  assert.equal(result.stage, "released");
  assert.equal(result.requiresRepair, false);
  assert.equal(result.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide returns failed_repairable when validation fails within budget", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: true,
    validationPassed: false,
    failedChecks: [{ check: "test", details: "failed" }],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 3,
  };

  const result = service.decide(input);

  assert.equal(result.stage, "failed_repairable");
  assert.equal(result.requiresRepair, true);
  assert.equal(result.requiresEscalation, false);
});

test("ValidationRepairLoopService.decide returns escalated when repair budget exhausted", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: true,
    validationPassed: false,
    failedChecks: [{ check: "test", details: "failed" }],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 3,
    maxRepairRounds: 3,
  };

  const result = service.decide(input);

  assert.equal(result.stage, "escalated");
  assert.equal(result.requiresRepair, false);
  assert.equal(result.requiresEscalation, true);
});

test("ValidationRepairLoopService.decide returns failed_blocking when forbidden scope touched", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: true,
    validationPassed: true,
    failedChecks: [],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 3,
    touchedForbiddenScope: true,
  };

  const result = service.decide(input);

  assert.equal(result.stage, "failed_blocking");
  assert.equal(result.requiresRepair, false);
  assert.equal(result.requiresEscalation, true);
  assert.equal(result.reasonCode, "validation.forbidden_scope_touched");
});

test("ValidationRepairLoopService.decide returns failed_repairable when review fails within budget", () => {
  const service = new ValidationRepairLoopService();
  const input: ValidationLoopInput = {
    taskId: "task-1",
    reviewPassed: false,
    validationPassed: true,
    failedChecks: [],
    changedFiles: [],
    allowedFixScope: [],
    forbiddenScope: [],
    maxDiffLines: 100,
    repairRound: 0,
    maxRepairRounds: 3,
  };

  const result = service.decide(input);

  assert.equal(result.stage, "failed_repairable");
  assert.equal(result.requiresRepair, true);
});

// =============================================================================
// Stalled Execution Detector Tests
// =============================================================================

test("StalledExecutionDetector.detect returns empty when executions are active", () => {
  const store = createMockStore({
    listActiveExecutionActivity: () => [
      {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        updatedAt: new Date().toISOString(),
        latestHeartbeatAt: new Date().toISOString(),
        latestEventAt: new Date().toISOString(),
      },
    ],
  });
  const detector = new StalledExecutionDetector(store);
  const now = new Date().toISOString();

  const findings = detector.detect({ now, staleAfterMs: 60000 });

  assert.equal(findings.length, 0);
});

test("StalledExecutionDetector.detect returns finding when no recent progress", () => {
  const oldTimestamp = new Date(Date.now() - 10 * 60000).toISOString();
  const store = createMockStore({
    listActiveExecutionActivity: () => [
      {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        updatedAt: oldTimestamp,
        latestHeartbeatAt: oldTimestamp,
        latestEventAt: oldTimestamp,
      },
    ],
  });
  const detector = new StalledExecutionDetector(store);
  const now = new Date().toISOString();

  const findings = detector.detect({ now, staleAfterMs: 60000 });

  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.executionId, "exec-1");
  assert.equal(findings[0]!.staleKind, "missing_heartbeat");
  assert.equal(findings[0]!.recommendedAction, "lease_reclaim");
});

test("StalledExecutionDetector.detect returns no_progress when heartbeat exists but no progress", () => {
  const oldTimestamp = new Date(Date.now() - 10 * 60000).toISOString();
  const recentHeartbeat = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago - within 30s grace
  const store = createMockStore({
    listActiveExecutionActivity: () => [
      {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        updatedAt: oldTimestamp,
        latestHeartbeatAt: recentHeartbeat,
        latestEventAt: oldTimestamp,
      },
    ],
  });
  const detector = new StalledExecutionDetector(store);
  const now = new Date().toISOString();

  const findings = detector.detect({ now, staleAfterMs: 60000, heartbeatGraceMs: 30000 });

  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.staleKind, "no_progress");
  assert.equal(findings[0]!.recommendedAction, "restart_or_escalate");
});

test("StalledExecutionDetector.detect with custom staleAfterMs", () => {
  const oldTimestamp = new Date(Date.now() - 120 * 60000).toISOString();
  const store = createMockStore({
    listActiveExecutionActivity: () => [
      {
        executionId: "exec-1",
        taskId: "task-1",
        agentId: "agent-1",
        status: "executing",
        updatedAt: oldTimestamp,
        latestHeartbeatAt: null,
        latestEventAt: null,
      },
    ],
  });
  const detector = new StalledExecutionDetector(store);
  const now = new Date().toISOString();

  // With staleAfterMs of 5 minutes (300000ms), this execution at 120 minutes old is definitely stale
  const findings = detector.detect({ now, staleAfterMs: 300000 });

  assert.equal(findings.length, 1);
});

test("StalledExecutionDetector.detect returns empty list when no active executions", () => {
  const store = createMockStore({
    listActiveExecutionActivity: () => [],
  });
  const detector = new StalledExecutionDetector(store);

  const findings = detector.detect();

  assert.equal(findings.length, 0);
});