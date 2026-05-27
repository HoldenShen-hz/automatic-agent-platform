import assert from "node:assert/strict";
import test from "node:test";

import { toWorkerSchedulingStatus } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-scheduling-status.js";
import type { WorkerStatus, WorkerSchedulingStatus } from "../../../../../src/platform/contracts/types/domain.js";

test("toWorkerSchedulingStatus maps degraded to degraded [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("degraded"), "degraded");
});

test("toWorkerSchedulingStatus maps draining to draining [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("draining"), "draining");
});

test("toWorkerSchedulingStatus maps quarantined to quarantined [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("quarantined"), "quarantined");
});

test("toWorkerSchedulingStatus maps offline to offline [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("offline"), "offline");
});

test("toWorkerSchedulingStatus maps unavailable to unavailable [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("unavailable"), "unavailable");
});

test("toWorkerSchedulingStatus maps idle to healthy [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
});

test("toWorkerSchedulingStatus maps busy to healthy [worker-scheduling-status]", () => {
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
});

test("toWorkerSchedulingStatus maps unknown status to healthy (default) [worker-scheduling-status]", () => {
  // Default case in switch should return healthy
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
});

test("toWorkerSchedulingStatus all statuses are valid WorkerSchedulingStatus values [worker-scheduling-status]", () => {
  const statuses: WorkerStatus[] = ["idle", "busy", "draining", "degraded", "unavailable", "quarantined", "offline"];
  for (const status of statuses) {
    const result = toWorkerSchedulingStatus(status);
    const validStatuses: WorkerSchedulingStatus[] = ["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"];
    assert.ok(validStatuses.includes(result), `Expected ${result} to be a valid WorkerSchedulingStatus`);
  }
});
