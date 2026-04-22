import assert from "node:assert/strict";
import test from "node:test";

import * as platformOpsAgent from "../../../../src/ops-maturity/platform-ops-agent/index.js";

test("platform-ops-agent index exports PlatformOpsAgentService", () => {
  assert.ok(platformOpsAgent);
  assert.equal(typeof platformOpsAgent.PlatformOpsAgentService, "function");
});