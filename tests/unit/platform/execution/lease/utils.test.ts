import assert from "node:assert/strict";
import test from "node:test";

import {
  plusMs,
  parseJsonArray,
  mergeExecutionIds,
  removeExecutionId,
  toWorkerStatus,
} from "../../../../../src/platform/five-plane-execution/lease/utils.js";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import type { WorkerSnapshotRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// plusMs
// ---------------------------------------------------------------------------

test("plusMs adds milliseconds to ISO timestamp [utils]", () => {
  const input = "2026-01-01T00:00:00.000Z";
  const result = plusMs(input, 1000);
  assert.equal(result, "2026-01-01T00:00:01.000Z");
});

test("plusMs handles large millisecond values [utils]", () => {
  const input = "2026-01-01T00:00:00.000Z";
  const result = plusMs(input, 3600000); // 1 hour
  assert.equal(result, "2026-01-01T01:00:00.000Z");
});

test("plusMs handles zero milliseconds [utils]", () => {
  const input = "2026-01-01T12:30:45.123Z";
  const result = plusMs(input, 0);
  assert.equal(result, input);
});

// ---------------------------------------------------------------------------
// parseJsonArray
// ---------------------------------------------------------------------------

test("parseJsonArray parses valid JSON array [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray('["a", "b", "c"]', logger);
  assert.deepEqual(result, ["a", "b", "c"]);
});

test("parseJsonArray returns empty array for non-array JSON [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray('{"key": "value"}', logger);
  assert.deepEqual(result, []);
});

test("parseJsonArray filters out non-string elements [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray('["a", 123, true, null, "b"]', logger);
  assert.deepEqual(result, ["a", "b"]);
});

test("parseJsonArray returns empty array for invalid JSON [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray("not valid json", logger);
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty string [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray("", logger);
  assert.deepEqual(result, []);
});

test("parseJsonArray handles empty array [utils]", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const result = parseJsonArray("[]", logger);
  assert.deepEqual(result, []);
});

// ---------------------------------------------------------------------------
// mergeExecutionIds
// ---------------------------------------------------------------------------

test("mergeExecutionIds merges two arrays and sorts [utils]", () => {
  const result = mergeExecutionIds(["exec1", "exec3"], "exec2");
  assert.deepEqual(result, ["exec1", "exec2", "exec3"]);
});

test("mergeExecutionIds removes duplicates [utils]", () => {
  const result = mergeExecutionIds(["exec1", "exec2"], "exec1");
  assert.deepEqual(result, ["exec1", "exec2"]);
});

test("mergeExecutionIds handles empty existing array [utils]", () => {
  const result = mergeExecutionIds([], "exec1");
  assert.deepEqual(result, ["exec1"]);
});

test("mergeExecutionIds handles empty new id [utils]", () => {
  const result = mergeExecutionIds(["exec1", "exec2"], "");
  assert.deepEqual(result, ["", "exec1", "exec2"]);
});

test("mergeExecutionIds handles both empty [utils]", () => {
  const result = mergeExecutionIds([], "");
  assert.deepEqual(result, [""]);
});

// ---------------------------------------------------------------------------
// removeExecutionId
// ---------------------------------------------------------------------------

test("removeExecutionId removes existing id and sorts [utils]", () => {
  const result = removeExecutionId(["exec1", "exec2", "exec3"], "exec2");
  assert.deepEqual(result, ["exec1", "exec3"]);
});

test("removeExecutionId handles id not in array [utils]", () => {
  const result = removeExecutionId(["exec1", "exec2"], "exec3");
  assert.deepEqual(result, ["exec1", "exec2"]);
});

test("removeExecutionId handles empty array [utils]", () => {
  const result = removeExecutionId([], "exec1");
  assert.deepEqual(result, []);
});

test("removeExecutionId handles single element match [utils]", () => {
  const result = removeExecutionId(["exec1"], "exec1");
  assert.deepEqual(result, []);
});

test("removeExecutionId returns sorted array when unchanged [utils]", () => {
  const result = removeExecutionId(["exec3", "exec1"], "exec2");
  assert.deepEqual(result, ["exec1", "exec3"]);
});

// ---------------------------------------------------------------------------
// toWorkerStatus
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  const now = new Date().toISOString();
  return {
    workerId: "worker-1",
    status: "idle",
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 10,
    queueAffinity: null,
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    lastHeartbeatAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("toWorkerStatus returns unavailable when snapshot status is unavailable [utils]", () => {
  const snapshot = makeSnapshot({ status: "unavailable" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "unavailable");
});

test("toWorkerStatus returns quarantined when snapshot status is quarantined [utils]", () => {
  const snapshot = makeSnapshot({ status: "quarantined" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "quarantined");
});

test("toWorkerStatus returns offline when snapshot status is offline [utils]", () => {
  const snapshot = makeSnapshot({ status: "offline" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "offline");
});

test("toWorkerStatus returns draining when snapshot status is draining [utils]", () => {
  const snapshot = makeSnapshot({ status: "draining" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "draining");
});

test("toWorkerStatus returns degraded when snapshot status is degraded [utils]", () => {
  const snapshot = makeSnapshot({ status: "degraded" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "degraded");
});

test("toWorkerStatus returns busy when running executions exist [utils]", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, ["exec1", "exec2"]);
  assert.equal(result, "busy");
});

test("toWorkerStatus returns idle when no running executions [utils]", () => {
  const snapshot = makeSnapshot({ status: "idle" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "idle");
});

test("toWorkerStatus prioritizes unavailable over other statuses [utils]", () => {
  const snapshot = makeSnapshot({ status: "unavailable" });
  const result = toWorkerStatus(snapshot, ["exec1"]);
  assert.equal(result, "unavailable");
});

test("toWorkerStatus prioritizes quarantined over idle [utils]", () => {
  const snapshot = makeSnapshot({ status: "quarantined" });
  const result = toWorkerStatus(snapshot, []);
  assert.equal(result, "quarantined");
});

test("toWorkerStatus prioritizes offline over busy [utils]", () => {
  const snapshot = makeSnapshot({ status: "offline" });
  const result = toWorkerStatus(snapshot, ["exec1"]);
  assert.equal(result, "offline");
});
