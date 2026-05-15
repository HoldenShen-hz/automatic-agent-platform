import test from "node:test";
import assert from "node:assert/strict";
import { toWorkerSchedulingStatus } from "../../../src/platform/five-plane-execution/worker-pool/worker-scheduling-status.js";
import type { WorkerStatus } from "../../../src/platform/contracts/types/domain.js";

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

test("toWorkerSchedulingStatus default case returns healthy", () => {
  // This tests the `default:` clause which returns "healthy"
  // Using a type assertion to test with an unexpected status value
  const unknownStatus = "idle" as WorkerStatus;
  assert.equal(toWorkerSchedulingStatus(unknownStatus), "healthy");
});
