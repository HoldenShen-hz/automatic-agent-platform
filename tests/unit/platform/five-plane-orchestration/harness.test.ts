import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  toCanonicalHarnessRun,
  DEFAULT_TAINT_POLICY,
  DEFAULT_RANKING_POLICY,
  DEFAULT_REDACTION_POLICY,
  type ConstraintPack,
  type HarnessRunRuntimeState,
} from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/index.js";
import { AsyncHarnessService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/async-harness-service.js";
import { mapHarnessStepToOapeflirPhase } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/oapeflir-harness-mapping.js";

function makeConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    toolPolicy: { allowedTools: ["read_file", "write_file"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    ...overrides,
  };
}

test("HarnessRuntimeService.createRun produces valid runtime state", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  assert.equal(run.taskId, "task_001");
  assert.equal(run.domainId, "domain_test");
  assert.equal(run.status, "created");
  assert.ok(Array.isArray(run.steps));
  assert.equal(run.steps.length, 0);
  assert.ok(run.harnessRunId.length > 0);
  assert.ok(run.runId.length > 0);
});

test("HarnessRuntimeService.appendStep adds step to run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_002",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const updated = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task_002" },
    outputs: { plan: { steps: [] } },
  });

  assert.equal(updated.steps.length, 1);
  assert.equal(updated.steps[0]?.role, "planner");
  assert.equal(updated.steps[0]?.stage, "plan");
  assert.ok(updated.timeline.length >= 1);
  assert.equal(updated.timeline[0]?.type, "run_created");
});

test("HarnessRuntimeService.appendStep increments nodeRunIds when nodeRunId provided", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_003",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const updated = service.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
    nodeRunId: "node_run_abc",
  });

  assert.ok(updated.nodeRunIds.includes("node_run_abc"));
});

test("HarnessRuntimeService.captureContextSnapshot returns valid snapshot", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_004",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const snapshot = service.captureContextSnapshot(run);

  assert.ok(snapshot.snapshotId.length > 0);
  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, run.domainId);
  assert.equal(snapshot.iteration, 0);
  assert.equal(snapshot.stepCount, 0);
  assert.equal(snapshot.lastDecisionId, null);
});

test("HarnessRuntimeService.decide returns accept for high evaluator score", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.9 });

  assert.equal(decision.action, "accept");
  assert.ok(decision.reasonCodes.includes("harness.accepted"));
  assert.equal(typeof decision.confidence, "number");
});

test("HarnessRuntimeService.decide returns replan for low score", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.3 });

  assert.equal(decision.action, "replan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_replan_threshold"));
});

test("HarnessRuntimeService.decide returns retry_same_plan for marginal score", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.6 });

  assert.equal(decision.action, "retry_same_plan");
});

test("HarnessRuntimeService.decide returns escalate_to_human when required", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.8, requiresHuman: true });

  assert.equal(decision.action, "escalate_to_human");
  assert.ok(decision.reasonCodes.includes("harness.human_required"));
});

test("HarnessRuntimeService.decide returns abort when max iterations reached", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.9, maxIterationsReached: true });

  assert.equal(decision.action, "abort");
  assert.ok(decision.reasonCodes.includes("harness.max_iterations_reached"));
});

test("HarnessRuntimeService.decide returns downgrade_mode for high risk", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.9, riskScore: 0.9 });

  assert.equal(decision.action, "downgrade_mode");
  assert.ok(decision.reasonCodes.includes("harness.risk_high_downgrade"));
});

test("HarnessRuntimeService.listTimeline returns timeline events", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_011",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const timeline = service.listTimeline(run);

  assert.ok(Array.isArray(timeline));
  assert.ok(timeline.length >= 1);
  assert.equal(timeline[0]?.type, "run_created");
});

test("HarnessRuntimeService.writeMemory and readMemory work with run scope", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_012",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  service.writeMemory(run, "run", "key1", { value: "test_data" });
  const read = service.readMemory(run, "run", "key1");

  assert.deepEqual(read, { value: "test_data" });
});

test("HarnessRuntimeService.assertInvariants returns empty violations for valid run", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_013",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const result = service.assertInvariants(run);

  assert.ok(Array.isArray(result.violations));
  assert.equal(result.violations.length, 0);
});

test("HarnessRuntimeService.assertInvariants catches completed without completedAt", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_014",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const invalidRun: HarnessRunRuntimeState = {
    ...run,
    status: "completed",
    completedAt: null,
    decision: {
      decisionId: "dec_1",
      action: "accept",
      reasonCodes: ["test"],
      confidence: 1.0,
      createdAt: new Date().toISOString(),
    },
  };

  const result = service.assertInvariants(invalidRun);

  assert.ok(result.violations.some(v => v.includes("INV-5")));
});

test("HarnessRuntimeService.assertInvariants catches paused without pauseReason", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_015",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const invalidRun: HarnessRunRuntimeState = {
    ...run,
    status: "paused",
    pauseReason: null,
  };

  const result = service.assertInvariants(invalidRun);

  assert.ok(result.violations.some(v => v.includes("INV-6")));
});

test("toCanonicalHarnessRun converts runtime state to canonical form", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_016",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.harnessRunId, run.harnessRunId);
  assert.equal(canonical.tenantId, run.tenantId);
  assert.equal(canonical.confirmedTaskSpecId, run.confirmedTaskSpecId);
  assert.equal(canonical.status, run.status);
});

test("DEFAULT_TAINT_POLICY has required fields", () => {
  assert.ok(Array.isArray(DEFAULT_TAINT_POLICY.blockedPatterns));
  assert.equal(DEFAULT_TAINT_POLICY.requireSanitization, true);
  assert.ok(DEFAULT_TAINT_POLICY.blockedPatterns.length > 0);
});

test("DEFAULT_RANKING_POLICY has required fields", () => {
  assert.equal(typeof DEFAULT_RANKING_POLICY.relevanceWeight, "number");
  assert.equal(typeof DEFAULT_RANKING_POLICY.freshnessWeight, "number");
  assert.equal(typeof DEFAULT_RANKING_POLICY.trustWeight, "number");
});

test("DEFAULT_REDACTION_POLICY has required fields", () => {
  assert.ok(Array.isArray(DEFAULT_REDACTION_POLICY.redactPatterns));
  assert.equal(DEFAULT_REDACTION_POLICY.replacementMask, "***REDACTED***");
});

test("AsyncHarnessService.createRun queues a run", async () => {
  const harnessService = new HarnessRuntimeService();
  const asyncService = new AsyncHarnessService(harnessService);

  const runId = await asyncService.createRun({
    taskId: "async_task_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
    plannerOutput: {},
    generatorOutput: {},
    evaluatorOutput: {},
    evaluatorScore: 0.8,
  });

  const queued = asyncService.get(runId);
  assert.ok(queued !== null);
  assert.equal(queued.status, "queued");
  assert.equal(queued.input.taskId, "async_task_001");
});

test("AsyncHarnessService.getRunStatus returns null for unknown run", () => {
  const harnessService = new HarnessRuntimeService();
  const asyncService = new AsyncHarnessService(harnessService);

  const status = asyncService.getRunStatus("nonexistent_run");

  assert.equal(status, null);
});

test("mapHarnessStepToOapeflirPhase maps planner role to plan phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "other"), "plan");
});

test("mapHarnessStepToOapeflirPhase maps generator role to execute phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "execute"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "other"), "execute");
});

test("mapHarnessStepToOapeflirPhase maps evaluator role to feedback phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "evaluate"), "feedback");
});

test("mapHarnessStepToOapeflirPhase maps hitl_operator to feedback phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("hitl_operator", "review"), "feedback");
});

test("mapHarnessStepToOapeflirPhase maps loop_controller to improve phase", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("loop_controller", "loop"), "improve");
});

test("HarnessRuntimeService.createAsyncService returns AsyncHarnessService", () => {
  const service = new HarnessRuntimeService();
  const asyncService = service.createAsyncService();

  assert.ok(asyncService instanceof AsyncHarnessService);
});

test("HarnessRuntimeService.evaluateRun returns evaluation result", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_eval_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const result = service.evaluateRun(run);

  assert.ok(result !== undefined);
});

test("HarnessRuntimeService.appendStep sets semanticPhase based on role", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_phase_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const plannerRun = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  assert.equal(plannerRun.steps[0]?.semanticPhase, "plan");

  const generatorRun = service.appendStep(plannerRun, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
  });

  assert.equal(generatorRun.steps[1]?.semanticPhase, "execute");

  const evaluatorRun = service.appendStep(generatorRun, {
    role: "evaluator",
    stage: "evaluate",
    inputs: {},
    outputs: {},
  });

  assert.equal(evaluatorRun.steps[2]?.semanticPhase, "feedback");
});

test("HarnessRuntimeService.createRun sets loopMetrics with budget constraints", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_metrics_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({
      budget: { maxSteps: 5, maxCost: 2.0, maxDurationMs: 120000 },
    }),
  });

  const metrics = run.loopMetrics;
  assert.ok(metrics != null);
  assert.equal(metrics.maxIterations, 5);
  assert.equal(metrics.maxCost, 2.0);
  assert.equal(metrics.maxDurationMs, 120000);
});

test("HarnessRuntimeService.createRun initializes planGraphBundle", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task_pgb_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  assert.ok(run.planGraphBundle !== null);
  assert.ok(run.planGraphBundle.planGraphBundleId.length > 0);
  assert.ok(Array.isArray(run.planGraphBundle.graph.nodes));
  assert.ok(Array.isArray(run.planGraphBundle.graph.edges));
});
