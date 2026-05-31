import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionWorkerHandshakeServiceAsync as ScaleExecutionWorkerHandshakeServiceAsync } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service-async.js";
import { ExecutionWorkerHandshakeServiceAsync as PlatformExecutionWorkerHandshakeServiceAsync } from "../../../../src/platform/five-plane-execution/worker-pool/execution-worker-handshake-service-async.js";

test("scale worker-handshake async mirrors the platform facade [execution-worker-handshake-service-async]", () => {
  assert.equal(ScaleExecutionWorkerHandshakeServiceAsync, PlatformExecutionWorkerHandshakeServiceAsync);
  assert.equal(typeof ScaleExecutionWorkerHandshakeServiceAsync.prototype.claimExecution, "function");
  assert.equal(typeof ScaleExecutionWorkerHandshakeServiceAsync.prototype.recordHeartbeat, "function");
  assert.equal(typeof ScaleExecutionWorkerHandshakeServiceAsync.prototype.getSyncService, "function");
});
