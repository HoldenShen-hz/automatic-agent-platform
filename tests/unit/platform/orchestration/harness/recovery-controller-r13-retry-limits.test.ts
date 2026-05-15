import assert from "node:assert/strict";
import test from "node:test";

import {
  RecoveryController,
  type HarnessFailureType,
} from "../../../../../src/platform/five-plane-orchestration/harness/recovery-controller.js";
import type { DurableHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import type {
  ConstraintPack,
  HarnessRunRuntimeState,
  HarnessRuntimeService,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import type { TypedEventPublisher } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-publisher.js";

const RETRY_BACKOFF_BASE_MS = 1_000;
const RETRY_BACKOFF_MAX_MS = 60_000;
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_JITTER_FACTOR = 0.1;

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    sandboxRequirement: { sandboxMode: "persistent", timeoutMs: 60_000 },
    approvalRequirement: { requiredForRiskClass: [], approverRoles: [], escalationTimeoutMs: 60_000 },
    budgetEnvelope: { maxSteps: 30, maxCost: 100, maxDurationMs: 60_000 },
    ...overrides,
  };
}

function createRun(overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  return {
    harnessRunId: "run-r13",
    runId: "run-r13",
    tenantId: "tenant:local",
    confirmedTaskSpecId: "confirmed_task_spec:run-r13",
    requestEnvelopeId: "request_envelope:run-r13",
    requestHash: "request_hash:run-r13",
    constraintPackRef: "constraint_pack:test",
    versionLockId: "version_lock:run-r13",
    budgetLedgerId: "budget_ledger:run-r13",
    currentSeq: 0,
    taskId: "task-r13",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    planGraphBundle: {
      planGraphBundleId: "plan_graph_bundle:run-r13",
      harnessRunId: "run-r13",
      graph: { nodes: [], edges: [] },
      validationReport: { valid: true, issues: [] },
      createdAt: "2026-05-09T00:00:00.000Z",
    },
    steps: [],
    maxIterations: 10,
    currentIteration: 1,
    status: "running",
    createdAt: "2026-05-09T00:00:00.000Z",
    updatedAt: "2026-05-09T00:00:00.000Z",
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
    loopMetrics: {
      iterationCount: 0,
      replanCount: 0,
      totalCost: 0,
    },
    ...overrides,
  } as HarnessRunRuntimeState;
}

function createController() {
  const persisted: HarnessRunRuntimeState[] = [];
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

  const durableService = {
    getCheckpointRef: () => null,
    restoreFromCheckpoint: () => null,
    restore: () => null,
    persist: (run: HarnessRunRuntimeState) => {
      persisted.push(run);
    },
  } as unknown as DurableHarnessService;

  const runtime = {
    recover: (run: HarnessRunRuntimeState) => ({
      ...run,
      status: "running",
      updatedAt: "2026-05-09T00:00:01.000Z",
    }),
    openHitlReview: (run: HarnessRunRuntimeState, reasonCode: string, _reasons: string[]) => ({
      ...run,
      status: "paused",
      pauseReason: "hitl_review",
      hitlRequest: {
        requestId: `hitl:${reasonCode}`,
        reasonCode,
      },
      sleepLease: null,
    }),
    sleep: (run: HarnessRunRuntimeState, reason: string, resumeAt: string, retryAttempt = 0) => ({
      ...run,
      status: "paused",
      pauseReason: "sleep",
      sleepLease: {
        leaseId: `sleep:${reason}`,
        runId: run.runId,
        reason,
        resumeAt,
        createdAt: "2026-05-09T00:00:01.000Z",
        retryAttempt,
      },
    }),
    resume: (run: HarnessRunRuntimeState) => ({
      ...run,
      status: "running",
      pauseReason: null,
    }),
  } as unknown as HarnessRuntimeService;

  const eventPublisher = {
    publish(event: { eventType: string; payload: Record<string, unknown> }) {
      events.push(event);
    },
  } as unknown as TypedEventPublisher;

  return {
    controller: new RecoveryController(durableService, runtime, undefined, eventPublisher),
    events,
    persisted,
  };
}

function assertDelayWithinBounds(resumeAt: string, attempt: number): void {
  const delayMs = new Date(resumeAt).getTime() - Date.now();
  const uncapped = RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1);
  const capped = Math.min(uncapped, RETRY_BACKOFF_MAX_MS);
  const maxDelay = capped * (1 + RETRY_JITTER_FACTOR);
  assert.ok(delayMs >= capped - 50, `delay ${delayMs}ms should be near lower bound ${capped}ms`);
  assert.ok(delayMs <= maxDelay + 50, `delay ${delayMs}ms should be <= upper bound ${maxDelay}ms`);
}

test("R13-13: llm_provider_unavailable retries with exponential backoff and emits node-scope repair event", () => {
  const { controller, events, persisted } = createController();
  const result = controller.handleFailure(createRun(), "llm_provider_unavailable");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.equal(result.sleepLease?.reason, "llm_provider_unavailable_retry");
  assert.equal(result.sleepLease?.retryAttempt, 1);
  assertDelayWithinBounds(result.sleepLease!.resumeAt, 1);
  assert.equal(persisted.length, 1);
  assert.equal(events[0]?.eventType, "recovery:repair_applied");
  assert.equal(events[0]?.payload.scope, "node");
  assert.equal(events[0]?.payload.action, "retry_same_plan");
});

test("R13-13: llm_provider_unavailable escalates after max retries", () => {
  const { controller, events, persisted } = createController();
  const result = controller.handleFailure(
    createRun({
      sleepLease: {
        leaseId: "sleep:llm",
        runId: "run-r13",
        reason: "llm_provider_unavailable_retry",
        resumeAt: "2026-05-09T00:00:02.000Z",
        createdAt: "2026-05-09T00:00:01.000Z",
        retryAttempt: RETRY_MAX_ATTEMPTS,
      },
    }),
    "llm_provider_unavailable",
  );

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl_review");
  assert.equal(result.hitlRequest?.reasonCode, "llm_provider_retry_exhausted");
  assert.equal(persisted.length, 1);
  assert.equal(events[0]?.eventType, "recovery:decision_recorded");
  assert.equal(events[0]?.payload.action, "escalate_hitl");
});

test("R13-13: worker_crash now backs off instead of immediately resuming", () => {
  const { controller, events, persisted } = createController();
  const result = controller.handleFailure(createRun(), "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.equal(result.sleepLease?.reason, "worker_crash_retry");
  assert.equal(result.sleepLease?.retryAttempt, 1);
  assertDelayWithinBounds(result.sleepLease!.resumeAt, 1);
  assert.equal(persisted.length, 1);
  assert.equal(events[0]?.eventType, "recovery:repair_applied");
  assert.equal(events[0]?.payload.scope, "graph");
  assert.equal(events[0]?.payload.action, "replan");
});

test("R13-13: worker_crash escalates after max retries", () => {
  const { controller, events, persisted } = createController();
  const result = controller.handleFailure(
    createRun({
      sleepLease: {
        leaseId: "sleep:worker",
        runId: "run-r13",
        reason: "worker_crash_retry",
        resumeAt: "2026-05-09T00:00:02.000Z",
        createdAt: "2026-05-09T00:00:01.000Z",
        retryAttempt: RETRY_MAX_ATTEMPTS,
      },
    }),
    "worker_crash",
  );

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl_review");
  assert.equal(result.hitlRequest?.reasonCode, "worker_crash_retry_exhausted");
  assert.equal(persisted.length, 1);
  assert.equal(events[0]?.payload.scope, "graph");
  assert.equal(events[0]?.payload.action, "escalate_hitl");
});

test("R13-16: platform_panic remains graph-scope retry with backoff", () => {
  const { controller, events } = createController();
  const result = controller.handleFailure(createRun(), "platform_panic");

  assert.equal(result.sleepLease?.reason, "platform_panic_retry");
  assert.equal(result.sleepLease?.retryAttempt, 1);
  assert.equal(events[0]?.payload.scope, "graph");
  assert.equal(events[0]?.payload.action, "replan");
});

test("R13-16: determineRetryScope distinguishes node and graph failures", () => {
  const { controller } = createController();
  const cases: Array<[HarnessFailureType, "node" | "graph"]> = [
    ["llm_provider_unavailable", "node"],
    ["tool_timeout", "node"],
    ["platform_panic", "graph"],
    ["worker_crash", "graph"],
    ["budget_exhausted", "graph"],
  ];

  for (const [failure, expectedScope] of cases) {
    assert.equal(controller.determineRetryScope(failure), expectedScope);
  }
});
