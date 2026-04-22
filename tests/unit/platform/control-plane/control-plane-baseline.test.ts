import assert from "node:assert/strict";
import test from "node:test";

import {
  listControlPlaneCapabilityBaselines,
  resolveControlPlaneCapabilityBaseline,
} from "../../../../src/platform/control-plane/control-plane-baseline.js";

test("control plane baseline covers control-plane entry modules", () => {
  const baselines = listControlPlaneCapabilityBaselines();
  assert.equal(baselines.length, 12);
  assert.ok(resolveControlPlaneCapabilityBaseline("config-center").baselineServices.includes("ConfigGovernanceService"));
  assert.ok(resolveControlPlaneCapabilityBaseline("tenant").entryModule.endsWith("/tenant/index.ts"));
});
