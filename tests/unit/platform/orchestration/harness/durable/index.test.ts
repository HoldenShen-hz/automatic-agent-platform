import assert from "node:assert/strict";
import test from "node:test";

import { DurableHarnessService } from "../../../../../../src/platform/orchestration/harness/durable/index.js";

test("DurableHarnessService is exported", () => {
  assert.ok(DurableHarnessService != null);
});

test("DurableHarnessService is a constructor or class", () => {
  assert.equal(typeof DurableHarnessService, "function");
});