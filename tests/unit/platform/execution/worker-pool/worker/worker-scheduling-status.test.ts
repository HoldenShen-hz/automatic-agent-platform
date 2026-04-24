import assert from "node:assert/strict";
import test from "node:test";

import { toWorkerSchedulingStatus } from "../../../../../../src/platform/execution/worker-pool/worker/worker-scheduling-status.js";
import type { WorkerStatus } from "../../../../../../src/platform/contracts/types/domain.js";

test("toWorkerSchedulingStatus maps degraded to degraded", () => {
  assert.equal(toWorkerSchedulingStatus("degraded"), "degraded");
});

test("toWorkerSchedulingStatus maps draining to draining", () => {
  assert.equal(toWorkerSchedulingStatus("draining"), "draining");
});

test("toWorkerSchedulingStatus maps quarantined to quarantined", () => {
  assert.equal(toWorkerSchedulingStatus("quarantined"), "quarantined");
});

test("toWorkerSchedulingStatus maps offline to offline", () => {
  assert.equal(toWorkerSchedulingStatus("offline"), "offline");
});

test("toWorkerSchedulingStatus maps unavailable to unavailable", () => {
  assert.equal(toWorkerSchedulingStatus("unavailable"), "unavailable");
});

test("toWorkerSchedulingStatus maps idle to healthy", () => {
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
});

test("toWorkerSchedulingStatus maps busy to healthy", () => {
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
});

test("toWorkerSchedulingStatus maps unknown to healthy", () => {
  assert.equal(toWorkerSchedulingStatus("unknown" as WorkerStatus), "healthy");
});

test("toWorkerSchedulingStatus handles high priority status as healthy", () => {
  // high and urgent are execution states, not worker statuses
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
});

test("toWorkerSchedulingStatus default case returns healthy", () => {
  assert.equal(toWorkerSchedulingStatus("degraded"), "degraded");
  assert.equal(toWorkerSchedulingStatus("draining"), "draining");
  assert.equal(toWorkerSchedulingStatus("quarantined"), "quarantined");
  assert.equal(toWorkerSchedulingStatus("offline"), "offline");
  assert.equal(toWorkerSchedulingStatus("unavailable"), "unavailable");
  assert.equal(toWorkerSchedulingStatus("idle"), "healthy");
  assert.equal(toWorkerSchedulingStatus("busy"), "healthy");
});

test("toWorkerSchedulingStatus healthy statuses include idle and busy", () => {
  const healthyStatuses: WorkerStatus[] = ["idle", "busy"];
  for (const status of healthyStatuses) {
    assert.equal(toWorkerSchedulingStatus(status), "healthy", `${status} should map to healthy`);
  }
});

test("toWorkerSchedulingStatus administrative statuses preserve their names", () => {
  const adminStatuses: WorkerStatus[] = ["draining", "quarantined", "offline", "unavailable", "degraded"];
  for (const status of adminStatuses) {
    assert.equal(toWorkerSchedulingStatus(status), status, `${status} should preserve its name`);
  }
});

test("toWorkerSchedulingStatus all worker statuses are handled", () => {
  const allStatuses: WorkerStatus[] = ["idle", "busy", "degraded", "draining", "quarantined", "offline", "unavailable"];
  for (const status of allStatuses) {
    const result = toWorkerSchedulingStatus(status);
    assert.ok(typeof result === "string", `${status} should return a string`);
    assert.ok(["healthy", "degraded", "draining", "quarantined", "offline", "unavailable"].includes(result),
      `${status} should map to a valid scheduling status`);
  }
});
