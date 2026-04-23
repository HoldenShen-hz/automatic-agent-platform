import assert from "node:assert/strict";
import test from "node:test";
import { plusMs, parseJsonArray, mergeExecutionIds, removeExecutionId, toWorkerStatus, } from "../../../src/platform/execution/lease/utils.js";
import { StructuredLogger } from "../../../src/platform/shared/observability/structured-logger.js";
// plusMs tests
test("plusMs adds milliseconds to ISO timestamp", () => {
    const result = plusMs("2026-04-14T00:00:00.000Z", 1000);
    assert.equal(result, "2026-04-14T00:00:01.000Z");
});
test("plusMs adds zero milliseconds returns same time", () => {
    const result = plusMs("2026-04-14T12:30:00.000Z", 0);
    assert.equal(result, "2026-04-14T12:30:00.000Z");
});
test("plusMs adds large number of milliseconds crossing day boundary", () => {
    const result = plusMs("2026-04-14T23:00:00.000Z", 3_600_000); // +1 hour
    assert.equal(result, "2026-04-15T00:00:00.000Z");
});
test("plusMs handles subtracting with negative ms", () => {
    const result = plusMs("2026-04-14T01:00:00.000Z", -3_600_000); // -1 hour
    assert.equal(result, "2026-04-14T00:00:00.000Z");
});
test("plusMs adds 60 seconds (1 minute)", () => {
    const result = plusMs("2026-04-14T00:00:00.000Z", 60_000);
    assert.equal(result, "2026-04-14T00:01:00.000Z");
});
// parseJsonArray tests
test("parseJsonArray parses valid JSON array of strings", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray('["a", "b", "c"]', logger);
    assert.deepEqual(result, ["a", "b", "c"]);
});
test("parseJsonArray returns empty array for empty JSON array", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray("[]", logger);
    assert.deepEqual(result, []);
});
test("parseJsonArray filters out non-string values", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray('["a", 1, true, null, "b"]', logger);
    assert.deepEqual(result, ["a", "b"]);
});
test("parseJsonArray returns empty array for non-array JSON", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray('{"key": "value"}', logger);
    assert.deepEqual(result, []);
});
test("parseJsonArray returns empty array for invalid JSON", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray("not valid json", logger);
    assert.deepEqual(result, []);
});
test("parseJsonArray returns empty array for null JSON", () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const result = parseJsonArray("null", logger);
    assert.deepEqual(result, []);
});
// mergeExecutionIds tests
test("mergeExecutionIds adds new execution ID", () => {
    const result = mergeExecutionIds(["exec_1", "exec_2"], "exec_3");
    assert.deepEqual(result, ["exec_1", "exec_2", "exec_3"]);
});
test("mergeExecutionIds deduplicates existing ID", () => {
    const result = mergeExecutionIds(["exec_1", "exec_2"], "exec_1");
    assert.deepEqual(result, ["exec_1", "exec_2"]);
});
test("mergeExecutionIds sorts the result", () => {
    const result = mergeExecutionIds(["exec_3", "exec_1"], "exec_2");
    assert.deepEqual(result, ["exec_1", "exec_2", "exec_3"]);
});
test("mergeExecutionIds handles empty existing array", () => {
    const result = mergeExecutionIds([], "exec_1");
    assert.deepEqual(result, ["exec_1"]);
});
// removeExecutionId tests
test("removeExecutionId removes existing ID", () => {
    const result = removeExecutionId(["exec_1", "exec_2", "exec_3"], "exec_2");
    assert.deepEqual(result, ["exec_1", "exec_3"]);
});
test("removeExecutionId handles non-existing ID gracefully", () => {
    const result = removeExecutionId(["exec_1", "exec_2"], "exec_unknown");
    assert.deepEqual(result, ["exec_1", "exec_2"]);
});
test("removeExecutionId returns empty array when only ID is removed", () => {
    const result = removeExecutionId(["exec_1"], "exec_1");
    assert.deepEqual(result, []);
});
test("removeExecutionId sorts result", () => {
    const result = removeExecutionId(["exec_c", "exec_b", "exec_a"], "exec_b");
    assert.deepEqual(result, ["exec_a", "exec_c"]);
});
// toWorkerStatus tests
function makeSnapshot(overrides = {}) {
    const now = new Date().toISOString();
    return {
        workerId: "worker_123",
        runtimeInstanceId: "instance_abc",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "idle",
        capabilitiesJson: "[]",
        runningExecutionsJson: "[]",
        maxConcurrency: 4,
        queueAffinity: null,
        cpuPct: null,
        memoryMb: null,
        toolBacklogCount: 0,
        currentStepId: null,
        lastProgressAt: null,
        lastHeartbeatAt: now,
        updatedAt: now,
        ...overrides,
    };
}
test("toWorkerStatus returns unavailable when status is unavailable", () => {
    const snapshot = makeSnapshot({ status: "unavailable" });
    assert.equal(toWorkerStatus(snapshot, []), "unavailable");
    assert.equal(toWorkerStatus(snapshot, ["exec_1"]), "unavailable");
});
test("toWorkerStatus returns quarantined when status is quarantined", () => {
    const snapshot = makeSnapshot({ status: "quarantined" });
    assert.equal(toWorkerStatus(snapshot, []), "quarantined");
});
test("toWorkerStatus returns offline when status is offline", () => {
    const snapshot = makeSnapshot({ status: "offline" });
    assert.equal(toWorkerStatus(snapshot, []), "offline");
});
test("toWorkerStatus returns draining when status is draining", () => {
    const snapshot = makeSnapshot({ status: "draining" });
    assert.equal(toWorkerStatus(snapshot, []), "draining");
});
test("toWorkerStatus returns degraded when status is degraded", () => {
    const snapshot = makeSnapshot({ status: "degraded" });
    assert.equal(toWorkerStatus(snapshot, []), "degraded");
});
test("toWorkerStatus returns idle when active and no running executions", () => {
    const snapshot = makeSnapshot({ status: "idle" });
    assert.equal(toWorkerStatus(snapshot, []), "idle");
});
test("toWorkerStatus returns busy when active and has running executions", () => {
    const snapshot = makeSnapshot({ status: "idle" });
    assert.equal(toWorkerStatus(snapshot, ["exec_1"]), "busy");
});
test("toWorkerStatus returns busy when busy and has running executions", () => {
    const snapshot = makeSnapshot({ status: "busy" });
    assert.equal(toWorkerStatus(snapshot, ["exec_1", "exec_2"]), "busy");
});
//# sourceMappingURL=execution-lease-utils.test.js.map