import assert from "node:assert/strict";
import test from "node:test";

import * as edgeRuntime from "../../../../src/ops-maturity/edge-runtime/index.js";

test("edge-runtime index exports EdgeRuntimeSyncService", () => {
  assert.ok(edgeRuntime);
  assert.equal(typeof edgeRuntime.EdgeRuntimeSyncService, "function");
});