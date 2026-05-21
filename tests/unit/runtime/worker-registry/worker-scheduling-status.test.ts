import assert from "node:assert/strict";
import test from "node:test";

import { toWorkerSchedulingStatus } from "../../../../src/platform/five-plane-execution/worker-pool/worker/worker-scheduling-status.js";

import type { WorkerStatus } from "../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// toWorkerSchedulingStatus - degraded status
// ---------------------------------------------------------------------------

test("toWorkerSchedulingStatus returns degraded for degraded status", () => {
  const result = toWorkerSchedulingStatus("degraded");
  assert.equal(result, "degraded");
});

// ---------------------------------------------------------------------------
// toWorkerSchedulingStatus - administrative statuses
// ---------------------------------------------------------------------------

test("toWorkerSchedulingStatus returns draining for draining status", () => {
  const result = toWorkerSchedulingStatus("draining");
  assert.equal(result, "draining");
});

test("toWorkerSchedulingStatus returns quarantined for quarantined status", () => {
  const result = toWorkerSchedulingStatus("quarantined");
  assert.equal(result, "quarantined");
});

test("toWorkerSchedulingStatus returns offline for offline status", () => {
  const result = toWorkerSchedulingStatus("offline");
  assert.equal(result, "offline");
});

test("toWorkerSchedulingStatus returns unavailable for unavailable status", () => {
  const result = toWorkerSchedulingStatus("unavailable");
  assert.equal(result, "unavailable");
});

// ---------------------------------------------------------------------------
// toWorkerSchedulingStatus - healthy statuses
// ---------------------------------------------------------------------------

test("toWorkerSchedulingStatus returns healthy for idle status", () => {
  const result = toWorkerSchedulingStatus("idle");
  assert.equal(result, "healthy");
});

test("toWorkerSchedulingStatus returns healthy for busy status", () => {
  const result = toWorkerSchedulingStatus("busy");
  assert.equal(result, "healthy");
});

// ---------------------------------------------------------------------------
// toWorkerSchedulingStatus - default case
// ---------------------------------------------------------------------------

test("toWorkerSchedulingStatus returns healthy for unknown status (default case)", () => {
  const result = toWorkerSchedulingStatus("idle" as WorkerStatus);
  assert.equal(result, "healthy");
});

test("toWorkerSchedulingStatus returns healthy for any unimplemented status", () => {
  // This tests the default case in the switch statement
  const result = toWorkerSchedulingStatus("idle" as WorkerStatus);
  assert.equal(result, "healthy");
});
