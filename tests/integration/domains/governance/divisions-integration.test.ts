import assert from "node:assert/strict";
import test from "node:test";

import { loadConfiguredDivisionRegistry } from "../../../../src/domains/governance/division-loader.js";
import { IntakeRouter } from "../../../../src/platform/five-plane-orchestration/routing/intake-router.js";

test("division registry loads the real overlapping routing definitions", () => {
  const registry = loadConfiguredDivisionRegistry();

  assert.ok(registry.divisions.has("engineering_ops"));
  assert.ok(registry.divisions.has("support"));
  assert.ok(registry.divisions.has("operations"));
  assert.ok(registry.divisions.has("devops"));
});

test("intake router deterministically prefers engineering_ops over support for overlapping fix triggers", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  const decision = router.route({
    request: "Fix the production issue that is blocking checkout for users.",
  });

  assert.equal(decision.divisionId, "engineering_ops");
  assert.ok(decision.routeTrace.some((item) => item.includes("engineering_ops:fix")));
  assert.ok(decision.routeTrace.some((item) => item.includes("support:issue") || item.includes("support:fix")));
});

test("intake router deterministically prefers devops over operations for overlapping deployment triggers", () => {
  const router = new IntakeRouter({
    divisionRegistry: loadConfiguredDivisionRegistry(),
  });

  const decision = router.route({
    request: "Prepare the deployment checklist for tonight's release.",
  });

  assert.equal(decision.divisionId, "devops");
  assert.ok(decision.routeTrace.some((item) => item.includes("devops:deployment")));
  assert.ok(decision.routeTrace.some((item) => item.includes("operations:deployment")));
});
