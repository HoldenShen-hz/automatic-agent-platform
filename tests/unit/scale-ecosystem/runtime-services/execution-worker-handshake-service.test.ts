import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionWorkerHandshakeService } from "../../../../src/scale-ecosystem/runtime-services/execution-worker-handshake-service.js";

test("ExecutionWorkerHandshakeService is exported and is a class", () => {
  assert.equal(typeof ExecutionWorkerHandshakeService, "function");
});
