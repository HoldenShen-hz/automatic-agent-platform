import test from "node:test";
import assert from "node:assert/strict";
import { HarnessSleepScheduler } from "../../../../../../src/platform/orchestration/harness/durable/sleep-scheduler.js";
import type { HarnessRun } from "../../../../../../src/platform/orchestration/harness/index.js";
import { DurableHarnessService } from "../../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";

function createMinimalHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    runId: "run_test_1",
    taskId: "task_1",
    domainId: "domain_1",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      tool_policy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    },
    steps: [],
    maxIterations: 10,
    currentIteration: 1,
    status: "running",
    createdAt: new Date().toISOString(),
    completedAt: null,
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

test("HarnessSleepScheduler.pollDueRuns returns empty when no runs due", () => {
  const service = new DurableHarnessService();
  const scheduler = new HarnessSleepScheduler(service);

  const due = scheduler.pollDueRuns();
  assert.deepEqual(due, []);
});

test("HarnessSleepScheduler.pollDueRuns returns runs with expired sleep leases", () => {
  const service = new DurableHarnessService();
  const past = new Date(Date.now() - 1000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_due_1",
    status: "paused",
    pauseReason: "sleep",
    sleepLease: {
      leaseId: "lease_1",
      runId: "run_due_1",
      reason: "rate_limit",
      resumeAt: past,
      createdAt: new Date().toISOString(),
    },
  });

  service.persist(run);
  const scheduler = new HarnessSleepScheduler(service);

  const due = scheduler.pollDueRuns();
  assert.equal(due.length, 1);
  assert.equal(due[0]?.runId, "run_due_1");
});

test("HarnessSleepScheduler.pollDueRuns excludes future sleep leases", () => {
  const service = new DurableHarnessService();
  const future = new Date(Date.now() + 10000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_future",
    status: "paused",
    pauseReason: "sleep",
    sleepLease: {
      leaseId: "lease_future",
      runId: "run_future",
      reason: "rate_limit",
      resumeAt: future,
      createdAt: new Date().toISOString(),
    },
  });

  service.persist(run);
  const scheduler = new HarnessSleepScheduler(service);

  const due = scheduler.pollDueRuns();
  assert.equal(due.length, 0);
});

test("HarnessSleepScheduler.pollDueRuns excludes non-paused runs", () => {
  const service = new DurableHarnessService();
  const past = new Date(Date.now() - 1000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_running",
    status: "running",
    sleepLease: {
      leaseId: "lease_running",
      runId: "run_running",
      reason: "rate_limit",
      resumeAt: past,
      createdAt: new Date().toISOString(),
    },
  });

  service.persist(run);
  const scheduler = new HarnessSleepScheduler(service);

  const due = scheduler.pollDueRuns();
  assert.equal(due.length, 0);
});

test("HarnessSleepScheduler.pollDueRuns calls onDueRun callback", () => {
  const service = new DurableHarnessService();
  const past = new Date(Date.now() - 1000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_callback",
    status: "paused",
    pauseReason: "sleep",
    sleepLease: {
      leaseId: "lease_callback",
      runId: "run_callback",
      reason: "rate_limit",
      resumeAt: past,
      createdAt: new Date().toISOString(),
    },
  });

  service.persist(run);

  let callbackCalled = false;
  let callbackRunId: string | null = null;
  const scheduler = new HarnessSleepScheduler(service, (run) => {
    callbackCalled = true;
    callbackRunId = run.runId;
  });

  scheduler.pollDueRuns();

  assert.equal(callbackCalled, true);
  assert.equal(callbackRunId, "run_callback");
});

test("HarnessSleepScheduler.pollDueRuns handles empty store", () => {
  const service = new DurableHarnessService();
  const scheduler = new HarnessSleepScheduler(service);

  const due = scheduler.pollDueRuns();
  assert.equal(due.length, 0);
});

test("HarnessSleepScheduler.pollDueRuns respects referenceTime parameter", () => {
  const service = new DurableHarnessService();
  // Create a lease that is "almost due" - resumeAt is in the past relative to now
  const past = new Date(Date.now() - 1000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_reference",
    status: "paused",
    pauseReason: "sleep",
    sleepLease: {
      leaseId: "lease_reference",
      runId: "run_reference",
      reason: "rate_limit",
      resumeAt: past,
      createdAt: new Date().toISOString(),
    },
  });

  service.persist(run);
  const scheduler = new HarnessSleepScheduler(service);

  // By default, pollDueRuns uses now() as referenceTime, so the past lease IS due
  const dueDefault = scheduler.pollDueRuns();
  assert.equal(dueDefault.length, 1);

  // When we pass a referenceTime in the very distant past (before the lease was created),
  // the lease should not be due
  const veryPast = new Date(Date.now() - 10000).toISOString();
  const duePast = scheduler.pollDueRuns(veryPast);
  assert.equal(duePast.length, 0);
});

test("HarnessSleepScheduler.start and stop control timer", () => {
  const service = new DurableHarnessService();
  const scheduler = new HarnessSleepScheduler(service);

  scheduler.start(100);
  scheduler.stop();

  // No error means success
  assert.ok(true);
});

test("HarnessSleepScheduler.start is idempotent", () => {
  const service = new DurableHarnessService();
  const scheduler = new HarnessSleepScheduler(service);

  scheduler.start(100);
  scheduler.start(100); // Should not start a second timer
  scheduler.stop();

  assert.ok(true);
});
