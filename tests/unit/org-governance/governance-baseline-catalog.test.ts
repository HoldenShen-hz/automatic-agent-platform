import assert from "node:assert/strict";
import test from "node:test";

import {
  listGovernanceCapabilityBaselines,
  resolveGovernanceCapabilityBaseline,
} from "../../../src/org-governance/governance-baseline-catalog.js";

test("governance baseline catalog covers all six governance capabilities", () => {
  const baselines = listGovernanceCapabilityBaselines();
  assert.equal(baselines.length, 6);
  assert.ok(resolveGovernanceCapabilityBaseline("sso-scim").baselineServices.includes("IdentitySyncService"));
  assert.ok(resolveGovernanceCapabilityBaseline("delegated-governance").baselineServices.includes("SelfServiceGovernanceConsole"));
});
