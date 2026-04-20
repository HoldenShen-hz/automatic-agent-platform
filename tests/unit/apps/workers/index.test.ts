import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_APP_MANIFEST } from "../../../../src/apps/workers/index.js";

test("worker app manifest exposes worker runtime capabilities", () => {
  assert.equal(WORKER_APP_MANIFEST.kind, "worker");
  assert.ok(WORKER_APP_MANIFEST.capabilities.includes("dispatch_execution"));
});
