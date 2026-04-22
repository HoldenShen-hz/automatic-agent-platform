import assert from "node:assert/strict";
import test from "node:test";

import {
  listOpsMaturityCapabilityBaselines,
  resolveOpsMaturityCapabilityBaseline,
} from "../../../src/ops-maturity/ops-maturity-baseline-catalog.js";

test("ops-maturity baseline catalog covers the maturity capability set", () => {
  const baselines = listOpsMaturityCapabilityBaselines();
  assert.equal(baselines.length, 12);
  assert.ok(resolveOpsMaturityCapabilityBaseline("platform-ops-agent").baselineServices.includes("PlatformOpsAgentService"));
  assert.ok(resolveOpsMaturityCapabilityBaseline("workflow-debugger").baselineServices.includes("TimeTravelDebugService"));
});
