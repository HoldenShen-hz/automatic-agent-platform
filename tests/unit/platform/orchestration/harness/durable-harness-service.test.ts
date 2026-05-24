import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  DurableHarnessService,
  SqliteDurableHarnessStore,
} from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import {
  HarnessRuntimeService,
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 0.4, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 6, maxCost: 25, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60_000,
    },
  });
}

function createRun(runId = "task-durable") {
  const runtime = new HarnessRuntimeService();
  return runtime.createRun({
    taskId: runId,
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
}

test("DurableHarnessService persists and restores runtime state", () => {
  const service = new DurableHarnessService();
  const run = createRun("task-persist");

  const record = service.persist(run);
  const restored = service.restore(run.runId);

  assert.equal(record.run.runId, run.runId);
  assert.equal(restored?.taskId, "task-persist");
  assert.equal(service.getCheckpointRef(run.runId), null);
});

test("DurableHarnessService checkpoints runtime state", () => {
  const service = new DurableHarnessService();
  const run = createRun("task-checkpoint");

  const checkpointRef = service.checkpoint(run);
  const restored = service.restoreFromCheckpoint(checkpointRef);

  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
  assert.equal(service.getCheckpointRef(run.runId), checkpointRef);
  assert.equal(restored?.runId, run.runId);
});

test("DurableHarnessService filters due sleep leases", () => {
  const service = new DurableHarnessService();
  const dueRun = {
    ...createRun("task-due"),
    sleepLease: {
      leaseId: "lease-due",
      runId: "lease-due-run",
      reason: "awaiting_review",
      resumeAt: "2026-05-24T00:00:00.000Z",
      createdAt: "2026-05-23T23:59:00.000Z",
      retryAttempt: 1,
    },
  };
  const futureRun = {
    ...createRun("task-future"),
    sleepLease: {
      leaseId: "lease-future",
      runId: "lease-future-run",
      reason: "awaiting_review",
      resumeAt: "2026-05-25T00:00:00.000Z",
      createdAt: "2026-05-24T00:00:00.000Z",
      retryAttempt: 1,
    },
  };

  service.persist(dueRun);
  service.persist(futureRun);

  const leases = service.listDueSleepLeases("2026-05-24T12:00:00.000Z");
  assert.deepEqual(leases.map((lease) => lease.leaseId), ["lease-due"]);
});

test("DurableHarnessService emits timeline events per run", () => {
  const service = new DurableHarnessService();
  const run = createRun("task-events");

  service.persist(run);
  service.emitEvent({
    eventType: "checkpoint.created",
    runId: run.runId,
    payload: { taskId: run.taskId },
  });

  const events = service.listEvents(run.runId);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "checkpoint.created");
});

test("DurableHarnessService supports sqlite-backed storage", () => {
  const db = new DatabaseSync(":memory:");
  const service = new DurableHarnessService({
    store: new SqliteDurableHarnessStore(db),
  });
  const run = createRun("task-sqlite");

  service.persist(run);

  const restored = service.restore(run.runId);
  assert.equal(restored?.taskId, "task-sqlite");
});
