import assert from "node:assert/strict";
import test from "node:test";

import {
  listInteractionCapabilityBaselines,
  resolveInteractionCapabilityBaseline,
} from "../../../src/interaction/interaction-baseline-catalog.js";

test("interaction baseline catalog covers all six interaction capabilities", () => {
  const baselines = listInteractionCapabilityBaselines();
  assert.deepEqual(
    baselines.map((item) => item.capabilityId),
    ["nl-gateway", "goal-decomposer", "proactive-agent", "autonomy", "dashboard", "ux"],
  );
  assert.ok(resolveInteractionCapabilityBaseline("ux").baselineServices.includes("UserPortalService"));
});
