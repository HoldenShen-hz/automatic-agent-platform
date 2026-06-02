import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionBudgetRegistry } from "../../../../src/platform/shared/execution-budget-registry.js";

test("ExecutionBudgetRegistry blocks domain budget once triggers and executions exhaust the daily pool", () => {
  const registry = new ExecutionBudgetRegistry();
  registry.recordTrigger("general-ops", "2026-05-26T00:00:00.000Z");
  registry.recordExecution("general-ops", 1.25, "2026-05-26T00:10:00.000Z");

  const decision = registry.evaluateDomainBudget("general-ops", "2026-05-26T00:20:00.000Z", 2);

  assert.equal(decision.allowed, false);
  assert.equal(decision.reasonCode, "execution_budget_registry.domain_budget_exhausted");
  assert.equal(decision.snapshot.triggerCount, 1);
  assert.equal(decision.snapshot.executionCount, 1);
});
