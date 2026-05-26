import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryEvidenceStore,
  type EvidenceRecord,
} from "../../../../src/ops-maturity/drift-detection/evidence-store.js";

function createEvidenceRecord(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id: "ev_1",
    taskType: "code_generation",
    sessionId: "sess_1",
    traceId: "trace_1",
    success: true,
    costUsd: 0.05,
    latencyMs: 1000,
    toolCalls: 5,
    repairRounds: 0,
    rollback: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}

test("InMemoryEvidenceStore append adds record", async () => {
  const store = new InMemoryEvidenceStore();
  const record = createEvidenceRecord();
  
  await store.append(record);
  
  const retrieved = await store.getById("ev_1");
  assert.deepEqual(retrieved, record);
});

test("InMemoryEvidenceStore getById returns null for non-existent", async () => {
  const store = new InMemoryEvidenceStore();
  
  const result = await store.getById("nonexistent");
  
  assert.equal(result, null);
});

test("InMemoryEvidenceStore listByTaskType returns matching records", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", taskType: "code_generation" }));
  await store.append(createEvidenceRecord({ id: "ev_2", taskType: "code_generation" }));
  await store.append(createEvidenceRecord({ id: "ev_3", taskType: "refactoring" }));
  
  const results = await store.listByTaskType("code_generation");
  
  assert.equal(results.length, 2);
});

test("InMemoryEvidenceStore listByTaskType respects limit", async () => {
  const store = new InMemoryEvidenceStore();
  for (let i = 0; i < 10; i++) {
    await store.append(createEvidenceRecord({ id: `ev_${i}`, taskType: "code_generation" }));
  }
  
  const results = await store.listByTaskType("code_generation", 5);
  
  assert.equal(results.length, 5);
});

test("InMemoryEvidenceStore listFailures returns failed records", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_2", success: false }));
  await store.append(createEvidenceRecord({ id: "ev_3", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_4", success: false }));
  
  const results = await store.listFailures();
  
  assert.equal(results.length, 2);
  assert.ok(results.every(r => r.success === false));
});

test("InMemoryEvidenceStore listFailures filters by taskType", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", taskType: "code", success: false }));
  await store.append(createEvidenceRecord({ id: "ev_2", taskType: "refactor", success: false }));
  
  const results = await store.listFailures("code");
  
  assert.equal(results.length, 1);
  assert.equal(results[0]?.taskType, "code");
});

test("InMemoryEvidenceStore listSuccesses returns successful records", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_2", success: false }));
  await store.append(createEvidenceRecord({ id: "ev_3", success: true }));
  
  const results = await store.listSuccesses();
  
  assert.equal(results.length, 2);
  assert.ok(results.every(r => r.success === true));
});

test("InMemoryEvidenceStore listSuccesses filters by taskType", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", taskType: "code", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_2", taskType: "refactor", success: true }));
  
  const results = await store.listSuccesses("code");
  
  assert.equal(results.length, 1);
  assert.equal(results[0]?.taskType, "code");
});

test("InMemoryEvidenceStore getRecent returns most recent records", async () => {
  const store = new InMemoryEvidenceStore();
  for (let i = 0; i < 10; i++) {
    await store.append(createEvidenceRecord({ id: `ev_${i}` }));
  }
  
  const results = await store.getRecent(5);
  
  assert.equal(results.length, 5);
});

test("InMemoryEvidenceStore getRecent defaults to 100", async () => {
  const store = new InMemoryEvidenceStore();
  for (let i = 0; i < 150; i++) {
    await store.append(createEvidenceRecord({ id: `ev_${i}` }));
  }
  
  const results = await store.getRecent();
  
  assert.equal(results.length, 100);
});

test("InMemoryEvidenceStore getStatistics calculates correct stats", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", success: true, costUsd: 0.10, latencyMs: 1000 }));
  await store.append(createEvidenceRecord({ id: "ev_2", success: true, costUsd: 0.20, latencyMs: 2000 }));
  await store.append(createEvidenceRecord({ id: "ev_3", success: false, costUsd: 0.15, latencyMs: 1500 }));

  const stats = await store.getStatistics();

  assert.equal(stats.totalRecords, 3);
  assert.equal(stats.successCount, 2);
  assert.equal(stats.failureCount, 1);
  // Use approximate comparison for floating point
  assert.ok(Math.abs(stats.averageCostUsd - 0.15) < 0.001);
  assert.equal(stats.averageLatencyMs, 1500);
});

test("InMemoryEvidenceStore getStatistics handles empty store", async () => {
  const store = new InMemoryEvidenceStore();
  
  const stats = await store.getStatistics();
  
  assert.equal(stats.totalRecords, 0);
  assert.equal(stats.successCount, 0);
  assert.equal(stats.failureCount, 0);
  assert.equal(stats.averageCostUsd, 0);
  assert.equal(stats.averageLatencyMs, 0);
});

test("InMemoryEvidenceStore getStatistics groups by taskType", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1", taskType: "code", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_2", taskType: "code", success: true }));
  await store.append(createEvidenceRecord({ id: "ev_3", taskType: "code", success: false }));
  await store.append(createEvidenceRecord({ id: "ev_4", taskType: "refactor", success: true }));
  
  const stats = await store.getStatistics();
  
  assert.ok(stats.byTaskType["code"]);
  assert.equal(stats.byTaskType["code"].count, 3);
  assert.equal(stats.byTaskType["code"].successRate, 2/3);
  
  assert.ok(stats.byTaskType["refactor"]);
  assert.equal(stats.byTaskType["refactor"].count, 1);
});

test("InMemoryEvidenceStore getRecent returns records in insertion order", async () => {
  const store = new InMemoryEvidenceStore();
  await store.append(createEvidenceRecord({ id: "ev_1" }));
  await store.append(createEvidenceRecord({ id: "ev_2" }));
  await store.append(createEvidenceRecord({ id: "ev_3" }));
  
  const results = await store.getRecent(2);
  
  // Should return ev_2 and ev_3 (last two inserted)
  assert.equal(results[0]?.id, "ev_2");
  assert.equal(results[1]?.id, "ev_3");
});

test("InMemoryEvidenceStore falls back when structuredClone is unavailable", async () => {
  const originalStructuredClone = globalThis.structuredClone;
  const store = new InMemoryEvidenceStore();
  try {
    (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone }).structuredClone = undefined;
    const record = createEvidenceRecord({
      id: "ev_fallback",
      metadata: {
        nested: {
          ok: true,
        },
      },
    });
    await store.append(record);

    const loaded = await store.getById("ev_fallback");
    assert.deepEqual(loaded, record);
    assert.notEqual(loaded?.metadata, record.metadata);
  } finally {
    (globalThis as typeof globalThis & { structuredClone?: typeof structuredClone }).structuredClone = originalStructuredClone;
  }
});
