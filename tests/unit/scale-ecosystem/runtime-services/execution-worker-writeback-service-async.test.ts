import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerWritebackServiceAsync as ScaleExecutionWorkerWritebackServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-writeback-service-async.js";
import { ExecutionWorkerWritebackServiceAsync as PlatformExecutionWorkerWritebackServiceAsync } from "../../../../src/platform/five-plane-execution/worker-pool/execution-worker-writeback-service-async.js";

test("scale worker-writeback async mirrors the platform facade [execution-worker-writeback-service-async]", () => {
  assert.equal(ScaleExecutionWorkerWritebackServiceAsync, PlatformExecutionWorkerWritebackServiceAsync);
  assert.equal(typeof ScaleExecutionWorkerWritebackServiceAsync.prototype.recordWriteback, "function");
  assert.equal(typeof ScaleExecutionWorkerWritebackServiceAsync.prototype.getSyncService, "function");
});
