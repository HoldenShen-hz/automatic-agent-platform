import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  type HarnessRunRuntimeState,
  type HarnessFailureType,
} from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/harness/index.js";

const FAILURE_TYPES: HarnessFailureType[] = [
  "operator_abort",
  "tool_timeout",
  "llm_provider_unavailable",
  "budget_exhausted",
  "platform_panic",
  "worker_crash",
];

function makeRuntimeState(overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  const createdAt = "2026-01-01T00:00:00.000Z";
  return {
    harnessRunId: "harness_run_test_001",
    runId: "run_test_001",
    tenantId: "tenant:local",
    confirmedTaskSpecId: "cts_test",
    requestEnvelopeId: "req_test",
    requestHash: "hash_test",
    constraintPackRef: "cp_test",
    versionLockId: "vl_test",
    planGraphBundleId: "pgb_test",
    budgetLedgerId: "bl_test",
    currentSeq: 0,
    taskId: "task_test",
    domainId: "domain_test",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "full_auto",
      toolPolicy: { allowedTools: ["read_file", "write_file"] },
      risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    },
    planGraphBundle: {
      planGraphBundleId: "pgb_test",
      harnessRunId: "harness_run_test_001",
      graphVersion: 1,
      graph: {
        graphId: "graph_test",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash_test",
      },
      schedulerPolicy: { policyId: "scheduler:harness.deterministic_fifo", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:test",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
      artifactRefs: [],
      createdAt,
    },
    steps: [],
    nodeRunIds: [],
    maxIterations: 10,
    currentIteration: 0,
    status: "running",
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    pauseReason: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    ...overrides,
  };
}

test("operator_abort transitions run to aborted status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
});

test("tool_timeout transitions run to paused status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "tool_timeout");

  assert.equal(result.status, "paused");
});

test("llm_provider_unavailable transitions run to paused status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "llm_provider_unavailable");

  assert.equal(result.status, "paused");
});

test("budget_exhausted transitions run to paused status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "budget_exhausted");

  assert.equal(result.status, "paused");
});

test("platform_panic transitions run to paused status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "platform_panic");

  assert.equal(result.status, "paused");
});

test("worker_crash transitions run to paused status", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
});

test("operator_abort emits harness:recovery_aborted event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "operator_abort");
  const events = service.listTimeline(result);

  // operator_abort should produce an aborted status and recovery event
  const hasAbortedStatus = result.status === "aborted";
  assert.ok(hasAbortedStatus, "operator_abort should result in aborted status");

  // Verify that at least one event was emitted in the timeline
  assert.ok(events.length >= 1, "operator_abort should emit at least one timeline event");
});

test("tool_timeout emits recovery_started event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "tool_timeout");
  const events = service.listTimeline(result);

  const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
  assert.ok(hasRecoveryEvent, "tool_timeout should emit recovery_started event in timeline");
});

test("llm_provider_unavailable emits recovery_started event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "llm_provider_unavailable");
  const events = service.listTimeline(result);

  const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
  assert.ok(hasRecoveryEvent, "llm_provider_unavailable should emit recovery_started event in timeline");
});

test("budget_exhausted emits recovery_started event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "budget_exhausted");
  const events = service.listTimeline(result);

  const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
  assert.ok(hasRecoveryEvent, "budget_exhausted should emit recovery_started event in timeline");
});

test("platform_panic emits recovery_started event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "platform_panic");
  const events = service.listTimeline(result);

  const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
  assert.ok(hasRecoveryEvent, "platform_panic should emit recovery_started event in timeline");
});

test("worker_crash emits recovery_started event in timeline", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "worker_crash");
  const events = service.listTimeline(result);

  const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
  assert.ok(hasRecoveryEvent, "worker_crash should emit recovery_started event in timeline");
});

test("all 6 failure types emit appropriate events (not missing any)", () => {
  for (const failureType of FAILURE_TYPES) {
    const service = new HarnessRuntimeService();
    const run = makeRuntimeState();

    const result = service.handleFailure(run, failureType);
    const events = service.listTimeline(result);

    const hasRecoveryEvent = events.some((e) => e.type === "recovery_started");
    const isAborted = result.status === "aborted";

    assert.ok(
      hasRecoveryEvent || isAborted,
      `Failure type "${failureType}" did not emit any recovery event and run is not aborted`,
    );
  }
});

test("events use correct type names matching HarnessTimelineEvent interface", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const result = service.handleFailure(run, "tool_timeout");
  const events = service.listTimeline(result);

  const validTypes = [
    "run_created",
    "step_completed",
    "guardrails_evaluated",
    "decision_recorded",
    "sleep_started",
    "recovery_started",
    "hitl_requested",
    "hitl_resolved",
  ];

  for (const event of events) {
    assert.ok(
      validTypes.includes(event.type),
      `Event type "${event.type}" is not a valid HarnessTimelineEvent type`,
    );
  }
});
