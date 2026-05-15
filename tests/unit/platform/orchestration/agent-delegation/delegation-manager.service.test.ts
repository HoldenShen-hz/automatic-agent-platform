import assert from "node:assert/strict";
import test from "node:test";

import * as agentDelegation from "../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-manager.service.js";

test("delegation-manager.service module exports DelegationManagerService", () => {
  assert.ok("DelegationManagerService" in agentDelegation);
});

test("delegation-manager.service module exports delegation service functions", () => {
  const exports = Object.keys(agentDelegation);
  assert.ok(exports.length > 0, "delegation-manager.service should export something");
});