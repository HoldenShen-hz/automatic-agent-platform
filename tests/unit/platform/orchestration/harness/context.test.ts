import test from "node:test";
import assert from "node:assert/strict";
import { HarnessRuntimeService } from "../../../../../src/platform/orchestration/harness/index.js";
import type { ConstraintPack, HarnessRun } from "../../../../../src/platform/orchestration/harness/index.js";

test("HarnessRuntimeService is exported and can be instantiated", () => {
  const service = new HarnessRuntimeService();
  assert.ok(service !== undefined);
  assert.equal(typeof service.createRun, "function");
});

test("HarnessRuntimeService.createRun returns a valid HarnessRun", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["tool-a"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  assert.equal(run.taskId, "task-123");
  assert.equal(run.domainId, "domain-456");
  assert.equal(run.status, "created");
  assert.equal(run.steps.length, 0);
  assert.ok(run.runId !== undefined);
  assert.ok(run.createdAt !== undefined);
});

test("HarnessRuntimeService.appendStep adds a step to the run", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const updatedRun = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-123" },
    outputs: { plan: "test-plan" },
  });

  const step = updatedRun.steps[0];
  assert.ok(step !== undefined);
  assert.equal(step.role, "planner");
  assert.equal(step.stage, "plan");
});

test("HarnessRuntimeService.decide returns a HarnessDecision", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.9,
  });

  assert.ok(decision.decisionId !== undefined);
  assert.equal(decision.action, "accept");
  assert.ok(decision.confidence === 0.9);
  assert.ok(decision.createdAt !== undefined);
});

test("HarnessRuntimeService.decide returns replan for low score", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.3,
  });

  assert.equal(decision.action, "replan");
});

test("HarnessRuntimeService.decide returns retry_same_plan for medium score", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.6,
  });

  assert.equal(decision.action, "retry_same_plan");
});

test("HarnessRuntimeService.decide returns abort when maxIterationsReached", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.9,
    maxIterationsReached: true,
  });

  assert.equal(decision.action, "abort");
});

test("HarnessRuntimeService.decide returns escalate_to_human when requiresHuman", () => {
  const service = new HarnessRuntimeService();

  const decision = service.decide({
    evaluatorScore: 0.9,
    requiresHuman: true,
  });

  assert.equal(decision.action, "escalate_to_human");
});

test("HarnessRuntimeService.captureContextSnapshot returns a ContextSnapshot", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const snapshot = service.captureContextSnapshot(run);

  assert.ok(snapshot.snapshotId !== undefined);
  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, run.domainId);
  assert.equal(snapshot.iteration, 0);
  assert.equal(snapshot.stepCount, 0);
});

test("HarnessRuntimeService.assertInvariants returns empty violations for valid run", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const result = service.assertInvariants(run);
  assert.equal(result.violations.length, 0);
});

test("HarnessRuntimeService.sleep pauses a run with a sleep lease", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const sleepingRun = service.sleep(run, "waiting for resource", "2026-04-24T00:00:00Z");

  assert.equal(sleepingRun.status, "paused");
  assert.equal(sleepingRun.pauseReason, "sleep");
  assert.ok(sleepingRun.sleepLease !== null);
  assert.equal(sleepingRun.sleepLease?.reason, "waiting for resource");
  assert.equal(sleepingRun.sleepLease?.resumeAt, "2026-04-24T00:00:00Z");
});

test("HarnessRuntimeService.resume clears sleep lease and returns to running", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const sleepingRun = service.sleep(run, "waiting", "2026-04-24T00:00:00Z");
  const resumedRun = service.resume(sleepingRun);

  assert.equal(resumedRun.status, "running");
  assert.equal(resumedRun.pauseReason, null);
  assert.equal(resumedRun.sleepLease, null);
});

test("HarnessRuntimeService.recover pauses a run with a recovery checkpoint", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const recoveredRun = service.recover(run);

  assert.equal(recoveredRun.status, "paused");
  assert.equal(recoveredRun.pauseReason, "recovery");
  assert.ok(recoveredRun.recoveryCheckpoint !== null);
  assert.equal(recoveredRun.recoveryCheckpoint?.runId, run.runId);
});

test("HarnessRuntimeService.listTimeline returns timeline events", () => {
  const service = new HarnessRuntimeService();
  const constraintPack: ConstraintPack = {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const run = service.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack,
  });

  const timeline = service.listTimeline(run);

  assert.ok(Array.isArray(timeline));
  assert.ok(timeline.length > 0);
});
