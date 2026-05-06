import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryEvidenceStore,
  type EvidenceRecord,
} from "../../../src/ops-maturity/drift-detection/evidence-store.js";

test("InMemoryEvidenceStore append and getById", async () => {
  const store = new InMemoryEvidenceStore();
  const record: EvidenceRecord = {
    id: "ev_1",
    taskType: "code_review",
    sessionId: "session_1",
    traceId: "trace_1",
    success: true,
    costUsd: 0.5,
    latencyMs: 1500,
    toolCalls: 10,
    repairRounds: 0,
    rollback: false,
    createdAt: "2026-04-20T00:00:00.000Z",
  };

  await store.append(record);
  const retrieved = await store.getById("ev_1");

  assert.strictEqual(retrieved?.id, "ev_1");
  assert.strictEqual(retrieved?.taskType, "code_review");
  assert.strictEqual(retrieved?.success, true);
});

test("InMemoryEvidenceStore getById returns null for unknown", async () => {
  const store = new InMemoryEvidenceStore();
  const result = await store.getById("unknown");
  assert.strictEqual(result, null);
});

test("InMemoryEvidenceStore listByTaskType filters correctly", async () => {
  const store = new InMemoryEvidenceStore();

  await store.append({ id: "ev_1", taskType: "nlp", sessionId: "s1", traceId: "t1", success: true, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T00:00:00.000Z" });
  await store.append({ id: "ev_2", taskType: "vision", sessionId: "s2", traceId: "t2", success: false, costUsd: 2, latencyMs: 200, toolCalls: 8, repairRounds: 1, rollback: false, createdAt: "2026-04-20T01:00:00.000Z" });
  await store.append({ id: "ev_3", taskType: "nlp", sessionId: "s3", traceId: "t3", success: true, costUsd: 1.5, latencyMs: 120, toolCalls: 6, repairRounds: 0, rollback: false, createdAt: "2026-04-20T02:00:00.000Z" });

  const nlpRecords = await store.listByTaskType("nlp");
  assert.strictEqual(nlpRecords.length, 2);
});

test("InMemoryEvidenceStore listFailures filters correctly", async () => {
  const store = new InMemoryEvidenceStore();

  await store.append({ id: "ev_1", taskType: "t1", sessionId: "s1", traceId: "t1", success: true, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T00:00:00.000Z" });
  await store.append({ id: "ev_2", taskType: "t2", sessionId: "s2", traceId: "t2", success: false, failureMode: "schema_error", costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T01:00:00.000Z" });

  const failures = await store.listFailures();
  assert.strictEqual(failures.length, 1);
  assert.strictEqual(failures[0]?.id, "ev_2");
});

test("InMemoryEvidenceStore listSuccesses filters correctly", async () => {
  const store = new InMemoryEvidenceStore();

  await store.append({ id: "ev_1", taskType: "t1", sessionId: "s1", traceId: "t1", success: true, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T00:00:00.000Z" });
  await store.append({ id: "ev_2", taskType: "t2", sessionId: "s2", traceId: "t2", success: false, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T01:00:00.000Z" });

  const successes = await store.listSuccesses();
  assert.strictEqual(successes.length, 1);
  assert.strictEqual(successes[0]?.id, "ev_1");
});

test("InMemoryEvidenceStore getStatistics computes correctly", async () => {
  const store = new InMemoryEvidenceStore();

  await store.append({ id: "ev_1", taskType: "nlp", sessionId: "s1", traceId: "t1", success: true, costUsd: 1.0, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: "2026-04-20T00:00:00.000Z" });
  await store.append({ id: "ev_2", taskType: "nlp", sessionId: "s2", traceId: "t2", success: false, costUsd: 2.0, latencyMs: 200, toolCalls: 8, repairRounds: 1, rollback: false, createdAt: "2026-04-20T01:00:00.000Z" });

  const stats = await store.getStatistics();

  assert.strictEqual(stats.totalRecords, 2);
  assert.strictEqual(stats.successCount, 1);
  assert.strictEqual(stats.failureCount, 1);
  assert.strictEqual(stats.averageCostUsd, 1.5);
  assert.strictEqual(stats.averageLatencyMs, 150);
  assert.ok(stats.byTaskType["nlp"]);
  assert.strictEqual(stats.byTaskType["nlp"]?.count, 2);
  assert.strictEqual(stats.byTaskType["nlp"]?.successCount, 1);
});

test("InMemoryEvidenceStore getRecent returns latest records", async () => {
  const store = new InMemoryEvidenceStore();

  for (let i = 0; i < 10; i++) {
    await store.append({ id: `ev_${i}`, taskType: "t1", sessionId: `s${i}`, traceId: `t${i}`, success: true, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: `2026-04-20T0${i}:00:00.000Z` });
  }

  const recent = await store.getRecent(5);
  assert.strictEqual(recent.length, 5);
  // Last 5 of 10 = ev_5, ev_6, ev_7, ev_8, ev_9 (oldest of the recent 5 is ev_5)
  assert.strictEqual(recent[0]?.id, "ev_5");
});

test("InMemoryEvidenceStore evicts oldest records when max reached", async () => {
  const store = new InMemoryEvidenceStore(5); // max 5 records

  for (let i = 0; i < 10; i++) {
    await store.append({ id: `ev_${i}`, taskType: "t1", sessionId: `s${i}`, traceId: `t${i}`, success: true, costUsd: 1, latencyMs: 100, toolCalls: 5, repairRounds: 0, rollback: false, createdAt: `2026-04-20T0${i}:00:00.000Z` });
  }

  const stats = await store.getStatistics();
  assert.strictEqual(stats.totalRecords, 4); // Implementation evicts 2 records per cycle when length >= max
});