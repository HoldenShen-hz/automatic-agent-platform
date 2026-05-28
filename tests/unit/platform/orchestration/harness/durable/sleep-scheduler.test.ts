import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSleepScheduler } from "../../../../../../src/platform/five-plane-orchestration/harness/durable/sleep-scheduler.js";
import { DurableHarnessService } from "../../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 100, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

function createPausedRun(resumeAt: string) {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-sleep",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  return runtime.sleep(created, "rate_limit", resumeAt);
}

test("HarnessSleepScheduler returns due paused runs and excludes future leases", () => {
  const service = new DurableHarnessService();
  service.persist(createPausedRun(new Date(Date.now() - 1000).toISOString()));
  service.persist(createPausedRun(new Date(Date.now() + 10_000).toISOString()));

  const scheduler = new HarnessSleepScheduler(service);
  const due = scheduler.pollDueRuns();

  assert.equal(due.length, 1);
  assert.equal(due[0]?.pauseReason, "sleep");
});

test("HarnessSleepScheduler invokes callback for due runs and supports custom reference time", () => {
  const service = new DurableHarnessService();
  const dueRun = createPausedRun(new Date(Date.now() - 1000).toISOString());
  service.persist(dueRun);

  let callbackRunId: string | null = null;
  const scheduler = new HarnessSleepScheduler(service, (run) => {
    callbackRunId = run.runId;
  });

  assert.equal(scheduler.pollDueRuns().length, 1);
  assert.equal(callbackRunId, dueRun.runId);
  assert.equal(scheduler.pollDueRuns(new Date(Date.now() - 10_000).toISOString()).length, 0);
});

test("HarnessSleepScheduler start and stop are safe to call repeatedly", () => {
  const scheduler = new HarnessSleepScheduler(new DurableHarnessService());

  scheduler.start(100);
  const timer = (scheduler as unknown as { timer: NodeJS.Timeout | null }).timer;
  scheduler.start(100);
  scheduler.stop();

  assert.ok(timer != null);
  assert.equal((scheduler as unknown as { timer: NodeJS.Timeout | null }).timer, null);
});
