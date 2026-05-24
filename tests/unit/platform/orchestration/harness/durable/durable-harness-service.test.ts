import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  DurableHarnessService,
  InMemoryDurableHarnessStore,
  SqliteDurableHarnessStore,
  type DurableHarnessRecord,
} from "../../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import {
  HarnessRuntimeService,
  normalizeConstraintPack,
  type ConstraintPack,
} from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.4, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 8, maxCost: 50, maxDurationMs: 90_000 },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 90_000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60_000,
    },
  });
}

function createRun(taskId: string) {
  const runtime = new HarnessRuntimeService();
  return runtime.createRun({
    taskId,
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
}

test("InMemoryDurableHarnessStore saves and lists records", () => {
  const store = new InMemoryDurableHarnessStore();
  const run = createRun("task-store");
  const record: DurableHarnessRecord = {
    recordId: "record-1",
    run,
    checkpointRef: null,
    persistedAt: "2026-05-24T00:00:00.000Z",
  };

  store.saveRecord(record);

  assert.equal(store.getRecord(run.runId)?.recordId, "record-1");
  assert.equal(store.listRecords().length, 1);
});

test("SqliteDurableHarnessStore round-trips checkpoints", () => {
  const db = new DatabaseSync(":memory:");
  const store = new SqliteDurableHarnessStore(db);
  const run = createRun("task-sqlite-checkpoint");

  store.saveCheckpoint("checkpoint-1", run);

  assert.equal(store.getCheckpoint("checkpoint-1")?.runId, run.runId);
});

test("DurableHarnessService reuses record ids across updates", () => {
  const service = new DurableHarnessService();
  const run = createRun("task-update");

  const first = service.persist(run);
  const second = service.persist({ ...run, currentSeq: run.currentSeq + 1 });

  assert.equal(first.recordId, second.recordId);
  assert.equal(service.restore(run.runId)?.currentSeq, run.currentSeq + 1);
});
