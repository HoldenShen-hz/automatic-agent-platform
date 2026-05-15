import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, unlinkSync } from "node:fs";

import {
  InMemoryDurableHarnessStore,
  SqliteDurableHarnessStore,
  DurableHarnessService,
  type DurableHarnessRecord,
} from "../../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import type { HarnessRun, WorkflowSleepLease } from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createMinimalHarnessRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    runId: "run_test_1",
    taskId: "task_1",
    domainId: "domain_1",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
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

function createSleepLease(runId: string, resumeAt: string): WorkflowSleepLease {
  return {
    leaseId: "lease_1",
    runId,
    reason: "rate_limit",
    resumeAt,
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// InMemoryDurableHarnessStore Tests
// ─────────────────────────────────────────────────────────────────────────────

test("InMemoryDurableHarnessStore.saveRecord and getRecord", () => {
  const store = new InMemoryDurableHarnessStore();
  const run = createMinimalHarnessRun();
  const record: DurableHarnessRecord = {
    recordId: "rec_1",
    run,
    checkpointRef: null,
    persistedAt: new Date().toISOString(),
  };

  store.saveRecord(record);
  const retrieved = store.getRecord("run_test_1");

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.recordId, "rec_1");
  assert.equal(retrieved!.run.runId, "run_test_1");
});

test("InMemoryDurableHarnessStore.getRecord returns null for non-existent", () => {
  const store = new InMemoryDurableHarnessStore();
  const result = store.getRecord("non_existent");
  assert.equal(result, null);
});

test("InMemoryDurableHarnessStore.saveCheckpoint and getCheckpoint", () => {
  const store = new InMemoryDurableHarnessStore();
  const run = createMinimalHarnessRun();
  const checkpointRef = "checkpoint_abc";

  store.saveCheckpoint(checkpointRef, run);
  const retrieved = store.getCheckpoint(checkpointRef);

  assert.ok(retrieved !== null);
  assert.equal(retrieved!.runId, "run_test_1");
});

test("InMemoryDurableHarnessStore.getCheckpoint returns null for non-existent", () => {
  const store = new InMemoryDurableHarnessStore();
  const result = store.getCheckpoint("non_existent");
  assert.equal(result, null);
});

test("InMemoryDurableHarnessStore.listRecords", () => {
  const store = new InMemoryDurableHarnessStore();

  store.saveRecord({
    recordId: "rec_1",
    run: createMinimalHarnessRun({ runId: "run_1" }),
    checkpointRef: null,
    persistedAt: new Date().toISOString(),
  });
  store.saveRecord({
    recordId: "rec_2",
    run: createMinimalHarnessRun({ runId: "run_2" }),
    checkpointRef: null,
    persistedAt: new Date().toISOString(),
  });

  const records = store.listRecords();
  assert.equal(records.length, 2);
});

test("InMemoryDurableHarnessStore overwrites existing record on saveRecord", () => {
  const store = new InMemoryDurableHarnessStore();
  const run = createMinimalHarnessRun({ runId: "run_overwrite" });

  store.saveRecord({
    recordId: "rec_first",
    run,
    checkpointRef: null,
    persistedAt: new Date().toISOString(),
  });

  store.saveRecord({
    recordId: "rec_second",
    run: { ...run, status: "completed" },
    checkpointRef: null,
    persistedAt: new Date().toISOString(),
  });

  const retrieved = store.getRecord("run_overwrite");
  assert.ok(retrieved !== null);
  assert.equal(retrieved!.recordId, "rec_second");
});

// ─────────────────────────────────────────────────────────────────────────────
// DurableHarnessService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DurableHarnessService.persist stores and retrieves run", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  const record = service.persist(run);
  const restored = service.restore("run_test_1");

  assert.ok(record !== null);
  assert.ok(restored !== null);
  assert.equal(restored!.runId, "run_test_1");
});

test("DurableHarnessService.persist reuses existing recordId on update", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  const record1 = service.persist(run);
  const record2 = service.persist({ ...run, status: "completed" });

  assert.equal(record1.recordId, record2.recordId);
  assert.equal(record2.run.status, "completed");
});

test("DurableHarnessService.checkpoint creates checkpoint and returns ref", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  const checkpointRef = service.checkpoint(run);
  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
});

test("DurableHarnessService.checkpoint stores checkpoint for later retrieval", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  const checkpointRef = service.checkpoint(run);
  const restored = service.restoreFromCheckpoint(checkpointRef);

  assert.ok(restored !== null);
  assert.equal(restored!.runId, run.runId);
});

test("DurableHarnessService.restore returns null for non-existent", () => {
  const service = new DurableHarnessService();
  const result = service.restore("non_existent");
  assert.equal(result, null);
});

test("DurableHarnessService.restoreFromCheckpoint returns null for non-existent", () => {
  const service = new DurableHarnessService();
  const result = service.restoreFromCheckpoint("non_existent");
  assert.equal(result, null);
});

test("DurableHarnessService.getCheckpointRef returns ref after checkpoint", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  const checkpointRef = service.checkpoint(run);
  const ref = service.getCheckpointRef("run_test_1");

  assert.equal(ref, checkpointRef);
});

test("DurableHarnessService.getCheckpointRef returns null when no checkpoint", () => {
  const service = new DurableHarnessService();
  const run = createMinimalHarnessRun();

  service.persist(run);
  const ref = service.getCheckpointRef("run_test_1");

  assert.equal(ref, null);
});

test("DurableHarnessService.listDueSleepLeases returns leases ready to resume", () => {
  const service = new DurableHarnessService();
  const now = new Date().toISOString();
  const past = new Date(Date.now() - 1000).toISOString();
  const future = new Date(Date.now() + 10000).toISOString();

  const run1 = createMinimalHarnessRun({
    runId: "run_with_lease_1",
    sleepLease: createSleepLease("run_with_lease_1", past),
  });
  const run2 = createMinimalHarnessRun({
    runId: "run_with_lease_2",
    sleepLease: createSleepLease("run_with_lease_2", future),
  });
  const run3 = createMinimalHarnessRun({
    runId: "run_without_lease",
  });

  service.persist(run1);
  service.persist(run2);
  service.persist(run3);

  const due = service.listDueSleepLeases(now);
  assert.equal(due.length, 1);
  assert.equal(due[0]!.runId, "run_with_lease_1");
});

test("DurableHarnessService.listDueSleepLeases excludes future leases", () => {
  const service = new DurableHarnessService();
  const future = new Date(Date.now() + 10000).toISOString();

  const run = createMinimalHarnessRun({
    runId: "run_future_lease",
    sleepLease: createSleepLease("run_future_lease", future),
  });

  service.persist(run);

  const due = service.listDueSleepLeases(new Date().toISOString());
  assert.equal(due.length, 0);
});

test("DurableHarnessService uses custom store when provided", () => {
  const store = new InMemoryDurableHarnessStore();
  const service = new DurableHarnessService({ store });
  const run = createMinimalHarnessRun();

  service.persist(run);
  const restored = service.restore("run_test_1");

  assert.ok(restored !== null);
  assert.equal(restored!.runId, "run_test_1");
});

test("DurableHarnessService validates run when validateRun is provided", () => {
  const service = new DurableHarnessService({
    validateRun: (run) => {
      if (run.runId === "invalid") {
        throw new Error("Invalid run");
      }
    },
  });

  service.persist(createMinimalHarnessRun({ runId: "valid" }));
  const valid = service.restore("valid");
  assert.ok(valid !== null);

  assert.throws(() => {
    service.persist(createMinimalHarnessRun({ runId: "invalid" }));
  }, /Invalid run/);
});

test("DurableHarnessService.persist does not throw on validation pass", () => {
  const service = new DurableHarnessService({
    validateRun: () => {},
  });

  const run = createMinimalHarnessRun();
  assert.doesNotThrow(() => {
    service.persist(run);
  });
});
