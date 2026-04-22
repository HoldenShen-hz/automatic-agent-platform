import assert from "node:assert/strict";
import test from "node:test";

import {
  listScaleCapabilityBaselines,
  resolveScaleCapabilityBaseline,
} from "../../../src/scale-ecosystem/scale-baseline-catalog.js";

test("scale baseline catalog covers ecosystem and scale capabilities", () => {
  const baselines = listScaleCapabilityBaselines();
  assert.equal(baselines.length, 6);
  assert.ok(resolveScaleCapabilityBaseline("marketplace").baselineServices.includes("MarketplaceGovernanceService"));
  assert.ok(resolveScaleCapabilityBaseline("integration").baselineServices.includes("ConnectorFrameworkService"));
});
