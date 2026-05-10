import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  type HarnessRunRuntimeState,
} from "../../src/platform/five-plane-orchestration/harness/index.js";
import { RuntimeStateMachine } from "../../src/platform/five-plane-execution/runtime-state-machine.js";
import { createMinimalPlanGraphBundle } from "../helpers/fixtures/base.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

function makeRuntimeState(overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  const createdAt = "2026-05-10T00:00:00.000Z";
  return {
    harnessRunId: "harness_run_resume_test",
    runId: "run_resume_test",
    tenantId: "tenant:local",
    confirmedTaskSpecId: "cts_resume_test",
    requestEnvelopeId: "req_resume_test",
    requestHash: "hash_resume_test",
    constraintPackRef: "constraint_pack:test",
    versionLockId: "version_lock:test",
    budgetLedgerId: "budget_ledger:test",
    fencingToken: "fence_resume_test",
    currentSeq: 0,
    taskId: "task_resume_test",
    domainId: "operations",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "full_auto",
      tool_policy: { allowedTools: ["read_file", "write_file"] },
      risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.7 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 12, maxCost: 2, maxDurationMs: 60_000 },
    },
    planGraphBundle: createMinimalPlanGraphBundle("harness_run_resume_test", {
      planGraphBundleId: "pgb_resume_test",
    }),
    steps: [],
    nodeRunIds: [],
    maxIterations: 10,
    currentIteration: 1,
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

test("E2E Workflow Resume: canonical runtime sleep pause can be resumed", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const paused = service.sleep(run, "awaiting external dependency", "2026-05-10T00:05:00.000Z");
  assert.equal(paused.status, "paused");
  assert.equal(paused.pauseReason, "sleep");

  const resumed = service.resume(paused);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.pauseReason, null);
});

test("E2E Workflow Resume: partial step outputs are preserved across pause and resume", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState({
    steps: [
      {
        stepId: "step_extract",
        role: "generator",
        status: "completed",
        startedAt: "2026-05-10T00:00:00.000Z",
        completedAt: "2026-05-10T00:00:05.000Z",
        output: { step0_output: "completed" },
        rationale: "partial progress",
        evidenceRefs: [],
        nodeRunRefs: [],
        toolCalls: [],
        latency: 5000,
        cost: 0.01,
        nextAction: "continue",
      },
    ],
  });

  const paused = service.sleep(run, "wait for human confirmation", "2026-05-10T00:10:00.000Z");
  const resumed = service.resume(paused);

  assert.equal(resumed.steps.length, 1);
  assert.deepEqual(resumed.steps[0]?.output, { step0_output: "completed" });
  assert.equal(resumed.status, "running");
});

test("E2E Workflow Resume: paused canonical HarnessRun can be cancelled", () => {
  const machine = new RuntimeStateMachine();
  const pausedRun = makeRuntimeState({
    status: "paused",
    pauseReason: "sleep",
  });

  const transitioned = machine.transition({
    commandId: newId("cmd"),
    entityType: "HarnessRun",
    entityId: pausedRun.harnessRunId,
    principal: "workflow-resume-e2e",
    aggregateType: "HarnessRun",
    aggregate: pausedRun,
    fromStatus: "paused",
    toStatus: "cancelled",
    tenantId: pausedRun.tenantId,
    traceId: newId("trace"),
    reasonCode: "operator.cancelled",
    emittedBy: "tests/e2e/workflow-resume-flow.test.ts",
    fencingToken: pausedRun.fencingToken ?? "fence-resume-cancelled",
    auditRef: "audit://workflow-resume/cancelled",
  });

  assert.equal(transitioned.aggregate.status, "cancelled");
  assert.ok(transitioned.aggregate.terminalAt);
});

test("E2E Workflow Resume: multiple pause-resume cycles preserve canonical runtime invariants", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const pausedOnce = service.sleep(run, "first pause", "2026-05-10T00:15:00.000Z");
  const resumedOnce = service.resume(pausedOnce);
  const pausedTwice = service.sleep(resumedOnce, "second pause", "2026-05-10T00:20:00.000Z");
  const resumedTwice = service.resume(pausedTwice);

  assert.equal(pausedOnce.status, "paused");
  assert.equal(pausedTwice.status, "paused");
  assert.equal(resumedTwice.status, "running");
  assert.equal(resumedTwice.pauseReason, null);
  assert.ok(service.listTimeline(resumedTwice).length >= 2);
});

test("E2E Workflow Resume: HITL pause and approval resume use canonical runtime path", () => {
  const service = new HarnessRuntimeService();
  const run = makeRuntimeState();

  const paused = service.openHitlReview(run, "high_risk_change", [
    "evidence://workflow-resume/high-risk-change",
  ]);
  assert.equal(paused.status, "paused");
  assert.equal(paused.pauseReason, "hitl");
  assert.ok(paused.hitlRequest);

  const resumed = service.resolveHitlReview(paused, "approved");
  assert.equal(resumed.status, "running");
  assert.equal(resumed.pauseReason, null);
});
