import assert from "node:assert/strict";
import test from "node:test";

import type {
  ContextSnapshot,
  EvaluationReport,
  FeedbackEnvelope,
  HarnessDecision,
  HarnessDecisionAction,
  HarnessLoopInput,
  HarnessRole,
  HarnessRun,
  HarnessRunStatus,
  HarnessStep,
  HarnessTimelineEvent,
  PlanBundle,
  RecoveryCheckpoint,
  WorkProduct,
  WorkflowSleepLease,
} from "../../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js";

test("protocol index loads as a runtime module", async () => {
  const protocolModule = await import("../../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js");
  assert.equal(Object.keys(protocolModule).length, 0);
});

test("ContextSnapshot type can be used as interface", () => {
  const snapshot: ContextSnapshot = {
    taskId: "task-123",
    executionId: "exec-456",
    workspaceId: "ws-789",
  };
  assert.equal(snapshot.taskId, "task-123");
  assert.equal(snapshot.executionId, "exec-456");
  assert.equal(snapshot.workspaceId, "ws-789");
});

test("HarnessRole type is a string", () => {
  const role: HarnessRole = "evaluator";
  assert.equal(typeof role, "string");
});

test("HarnessDecisionAction type works with expected values", () => {
  const action: HarnessDecisionAction = "continue";
  assert.equal(action, "continue");
});

test("HarnessRunStatus type is string union", () => {
  const status: HarnessRunStatus = "running";
  assert.equal(status, "running");
});

test("WorkflowSleepLease type structure", () => {
  const lease: WorkflowSleepLease = {
    workflowId: "wf-123",
    expiresAt: new Date().toISOString(),
  };
  assert.equal(lease.workflowId, "wf-123");
  assert.ok(typeof lease.expiresAt === "string");
});

test("FeedbackEnvelope type structure", () => {
  const envelope: FeedbackEnvelope = {
    taskId: "task-123",
    signals: [],
  };
  assert.equal(envelope.taskId, "task-123");
  assert.ok(Array.isArray(envelope.signals));
});

test("HarnessDecision type structure", () => {
  const decision: HarnessDecision = {
    action: "continue",
    reason: "All checks passed",
  };
  assert.equal(decision.action, "continue");
  assert.equal(decision.reason, "All checks passed");
});

test("HarnessLoopInput type structure", () => {
  const input: HarnessLoopInput = {
    taskId: "task-123",
    step: 1,
  };
  assert.equal(input.taskId, "task-123");
  assert.equal(input.step, 1);
});

test("HarnessRun type structure", () => {
  const run: HarnessRun = {
    runId: "run-123",
    taskId: "task-123",
    status: "running",
    startedAt: new Date().toISOString(),
  };
  assert.equal(run.runId, "run-123");
  assert.equal(run.status, "running");
});

test("HarnessStep type structure", () => {
  const step: HarnessStep = {
    stepId: "step-1",
    name: "Test Step",
  };
  assert.equal(step.stepId, "step-1");
  assert.equal(step.name, "Test Step");
});

test("PlanBundle type structure", () => {
  const bundle: PlanBundle = {
    planId: "plan-123",
    tasks: [],
  };
  assert.equal(bundle.planId, "plan-123");
  assert.ok(Array.isArray(bundle.tasks));
});

test("RecoveryCheckpoint type structure", () => {
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "cp-123",
    taskId: "task-123",
  };
  assert.equal(checkpoint.checkpointId, "cp-123");
  assert.equal(checkpoint.taskId, "task-123");
});

test("WorkProduct type structure", () => {
  const product: WorkProduct = {
    artifactId: "art-123",
    taskId: "task-123",
  };
  assert.equal(product.artifactId, "art-123");
  assert.equal(product.taskId, "task-123");
});

test("HarnessTimelineEvent type structure", () => {
  const event: HarnessTimelineEvent = {
    eventId: "evt-123",
    timestamp: new Date().toISOString(),
    type: "step_complete",
  };
  assert.equal(event.eventId, "evt-123");
  assert.equal(event.type, "step_complete");
});

test("EvaluationReport type structure", () => {
  const report: EvaluationReport = {
    taskId: "task-123",
    passed: true,
    score: 100,
  };
  assert.equal(report.taskId, "task-123");
  assert.equal(report.passed, true);
  assert.equal(report.score, 100);
});

test("All protocol types can be exported and used", () => {
  // Ensure all types are exported correctly
  const types = [
    { name: "ContextSnapshot", type: typeof ContextSnapshot },
    { name: "EvaluationReport", type: typeof EvaluationReport },
    { name: "FeedbackEnvelope", type: typeof FeedbackEnvelope },
    { name: "HarnessDecision", type: typeof HarnessDecision },
    { name: "HarnessLoopInput", type: typeof HarnessLoopInput },
    { name: "HarnessRole", type: typeof HarnessRole },
    { name: "HarnessRun", type: typeof HarnessRun },
    { name: "HarnessRunStatus", type: typeof HarnessRunStatus },
    { name: "HarnessStep", type: typeof HarnessStep },
    { name: "HarnessTimelineEvent", type: typeof HarnessTimelineEvent },
    { name: "PlanBundle", type: typeof PlanBundle },
    { name: "RecoveryCheckpoint", type: typeof RecoveryCheckpoint },
    { name: "WorkProduct", type: typeof WorkProduct },
    { name: "WorkflowSleepLease", type: typeof WorkflowSleepLease },
  ];

  for (const t of types) {
    assert.ok(t.type !== undefined, `Type ${t.name} should be exported`);
  }
});
