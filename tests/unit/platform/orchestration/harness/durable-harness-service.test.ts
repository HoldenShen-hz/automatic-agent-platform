import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import {
  DurableHarnessService,
  SqliteDurableHarnessStore,
} from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { HarnessSleepScheduler } from "../../../../../src/platform/orchestration/harness/durable/sleep-scheduler.js";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";
import type { HarnessRun, ConstraintPack, HarnessRunStatus } from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    toolPolicy: { allowedTools: ["read", "summarize"] },
    risk_policy: { maxRiskScore: 70, escalationThreshold: 55 },
    output_policy: { requiredEvidence: ["risk_profile"], redactSensitiveData: true },
    budget: { maxSteps: 8, maxCost: 5, maxDurationMs: 60_000 },
    ...overrides,
  };
}

function createMinimalHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    runId: newId("harness_run"),
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    steps: [],
    maxIterations: 8,
    currentIteration: 0,
    status: "running" as HarnessRunStatus,
    createdAt: nowIso(),
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

test("DurableHarnessService.persist stores run and returns record", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  const record = service.persist(run);

  assert.equal(record.run.runId, run.runId);
  assert.equal(record.checkpointRef, null);
  assert.ok(record.recordId.startsWith("durable_run_"));
  assert.ok(record.persistedAt.length > 0);
});

test("DurableHarnessService.persist idempotency preserves same recordId", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun({ runId: "run-idempotent" });
  const record1 = service.persist(run);
  const record2 = service.persist(run);

  assert.equal(record1.recordId, record2.recordId);
  assert.equal(record1.run.runId, record2.run.runId);
});

test("DurableHarnessService.checkpoint creates checkpoint and returns ref", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  const checkpointRef = service.checkpoint(run);

  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
  const restored = service.restoreFromCheckpoint(checkpointRef);
  assert.equal(restored?.runId, run.runId);
});

test("DurableHarnessService.checkpoint updates record with checkpointRef", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  const checkpointRef = service.checkpoint(run);

  const ref = service.getCheckpointRef(run.runId);
  assert.equal(ref, checkpointRef);
});

test("DurableHarnessService.restore returns run for existing runId", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  service.persist(run);

  const restored = service.restore(run.runId);
  assert.equal(restored?.runId, run.runId);
});

test("DurableHarnessService.restore returns null for unknown runId", () => {
  const service = new DurableHarnessService();
  const restored = service.restore("unknown-run-id");
  assert.equal(restored, null);
});

test("DurableHarnessService.restoreFromCheckpoint returns null for unknown ref", () => {
  const service = new DurableHarnessService();
  const restored = service.restoreFromCheckpoint("unknown-checkpoint-ref");
  assert.equal(restored, null);
});

test("DurableHarnessService.getCheckpointRef returns null for run without checkpoint", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  service.persist(run);

  const ref = service.getCheckpointRef(run.runId);
  assert.equal(ref, null);
});

test("DurableHarnessService.getCheckpointRef returns ref for run with checkpoint", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  const checkpointRef = service.checkpoint(run);

  const ref = service.getCheckpointRef(run.runId);
  assert.equal(ref, checkpointRef);
});

test("DurableHarnessService.getCheckpointRef returns null for unknown runId", () => {
  const service = new DurableHarnessService();
  const ref = service.getCheckpointRef("non-existent-run");
  assert.equal(ref, null);
});

test("DurableHarnessService handles multiple runs independently", () => {
  const service = new DurableHarnessService();
  const run1 = createMinimalHarnessRun({ runId: "run-1", taskId: "task-a" });
  const run2 = createMinimalHarnessRun({ runId: "run-2", taskId: "task-b" });

  service.persist(run1);
  service.persist(run2);

  const restored1 = service.restore("run-1");
  const restored2 = service.restore("run-2");

  assert.equal(restored1?.taskId, "task-a");
  assert.equal(restored2?.taskId, "task-b");
});

test("DurableHarnessService.persist updates existing run record", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  const originalRecord = service.persist(run);

  const updatedRun = { ...run, status: "completed" as const, completedAt: nowIso() };
  const updatedRecord = service.persist(updatedRun);

  assert.equal(updatedRecord.recordId, originalRecord.recordId);
  const restored = service.restore(run.runId);
  assert.equal(restored?.status, "completed");
});

test("DurableHarnessService.checkpoint and restoreFromCheckpoint preserves full run state", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun({
    status: "running",
    currentIteration: 3,
    steps: [],
  });
  const checkpointRef = service.checkpoint(run);

  const restored = service.restoreFromCheckpoint(checkpointRef);
  assert.ok(restored !== null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.status, "running");
  assert.equal(restored.currentIteration, 3);
});

test("DurableHarnessService.restoreFromCheckpoint is independent of run persist", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();
  service.persist(run);

  const checkpointRef = service.checkpoint(run);

  service.persist({ ...run, status: "completed" as const });

  const fromCheckpoint = service.restoreFromCheckpoint(checkpointRef);
  assert.ok(fromCheckpoint !== null);
});

test("DurableHarnessService supports sqlite-backed persistence", () => {
  const db = new DatabaseSync(":memory:");
  const service = new DurableHarnessService({
    store: new SqliteDurableHarnessStore(db),
  });
  const run = createMinimalHarnessRun({ runId: "sqlite-run" });

  service.persist(run);

  const restored = service.restore("sqlite-run");
  assert.equal(restored?.runId, "sqlite-run");
});

test("HarnessSleepScheduler polls due paused runs with sleep leases", () => {
  const service = new DurableHarnessService();
  const pausedRun = createMinimalHarnessRun({
    runId: "paused-run",
    status: "paused",
    pauseReason: "sleep",
    sleepLease: {
      leaseId: "lease-1",
      runId: "paused-run",
      reason: "awaiting_approval",
      resumeAt: "2026-04-20T00:00:00.000Z",
      createdAt: "2026-04-19T23:00:00.000Z",
    },
  });
  service.persist(pausedRun);

  const scheduler = new HarnessSleepScheduler(service);
  const dueRuns = scheduler.pollDueRuns("2026-04-21T00:00:00.000Z");

  assert.equal(dueRuns.length, 1);
  assert.equal(dueRuns[0]?.runId, "paused-run");
});
