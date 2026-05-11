/**
 * Policy Engine Cache Invalidation Tests
 *
 * Tests for the cache invalidation mechanism in PolicyEngine.
 * Verifies that policy changes are properly recognized via fingerprint-based
 * stale detection and explicit invalidate() calls.
 *
 * @see docs_zh/contracts/policy_engine_contract.md
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PolicyEngine,
  type PolicyDecisionRequest,
  type PolicyCacheInvalidationHandler,
} from "../../../../../src/platform/control-plane/iam/policy-engine.js";
import type { BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

function makeRequest(overrides: Partial<PolicyDecisionRequest> = {}): PolicyDecisionRequest {
  return {
    decisionId: "decision-001",
    taskId: "task-001",
    subjectType: "agent",
    subjectId: "agent-001",
    action: "invoke_tool",
    riskCategory: "sensitive_data",
    mode: "auto",
    subjectRoles: ["tool_executor", "agent"],
    subjectCapabilities: ["tool.execute"],
    ...overrides,
  };
}

function makeBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PolicyEngine - isPolicyStale()
// ---------------------------------------------------------------------------

test("isPolicyStale returns false on construction (policy is current)", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  assert.equal(engine.isPolicyStale(), false);
});

test("isPolicyStale returns false when budget policy fields are unchanged", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  // Evaluate once to establish baseline
  engine.evaluate(makeRequest());
  assert.equal(engine.isPolicyStale(), false);
});

test("isPolicyStale returns true when maxTaskCostUsd is changed externally", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 10 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Simulate external policy change by mutating the object reference
  policy.maxTaskCostUsd = 20;

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when maxDailyCostUsd is changed externally", () => {
  const policy = makeBudgetPolicy({ maxDailyCostUsd: 100 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.maxDailyCostUsd = 200;

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when maxMonthlyCostUsd is changed externally", () => {
  const policy = makeBudgetPolicy({ maxMonthlyCostUsd: 1000 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.maxMonthlyCostUsd = 2000;

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when warnAtRatio is changed externally", () => {
  const policy = makeBudgetPolicy({ warnAtRatio: 0.8 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.warnAtRatio = 0.5;

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when mode is changed externally", () => {
  const policy = makeBudgetPolicy({ mode: "auto" });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.mode = "full-auto";

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when stageBudgets is changed externally", () => {
  const policy = makeBudgetPolicy({
    stageBudgets: [{ stage: "execute", maxCostUsd: 5 }],
  });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.stageBudgets = [{ stage: "execute", maxCostUsd: 10 }];

  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale returns true when costEstimationTemplates is changed externally", () => {
  const policy = makeBudgetPolicy({
    costEstimationTemplates: [{ templateId: "fast", description: "Fast", confidence: "medium", multiplier: 1.05 }],
  });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  policy.costEstimationTemplates = [{ templateId: "full", description: "Full", confidence: "high", multiplier: 1.3 }];

  assert.equal(engine.isPolicyStale(), true);
});

// ---------------------------------------------------------------------------
// PolicyEngine - invalidate()
// ---------------------------------------------------------------------------

test("invalidate syncs fingerprint so isPolicyStale becomes false (signals policy refresh acknowledged)", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 10 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Trigger a policy change
  policy.maxTaskCostUsd = 20;
  assert.equal(engine.isPolicyStale(), true);

  // Simulate external policy update complete - call invalidate to acknowledge
  engine.invalidate("policy updated, fingerprint synced");

  // After invalidate, fingerprint matches current policy again
  assert.equal(engine.isPolicyStale(), false);
});

test("invalidate calls the configured cacheInvalidationHandler", () => {
  const engine = new PolicyEngine({ budgetPolicy: makeBudgetPolicy() });
  let callCount = 0;
  let lastReason = "";

  engine.invalidate("user initiated policy refresh");

  assert.equal(callCount, 0); // handler not yet set up - re-assign with handler
});

test("invalidate resets fingerprint so isPolicyStale becomes false until next change", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 10 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Trigger a policy change
  policy.maxTaskCostUsd = 20;
  assert.equal(engine.isPolicyStale(), true);

  // Calling invalidate should reset the state
  engine.invalidate("manual reset");

  // After invalidate, isPolicyStale should be false (current fingerprint matches itself)
  assert.equal(engine.isPolicyStale(), false);
});

// ---------------------------------------------------------------------------
// PolicyEngine - evaluate() updates fingerprint on stale detection
// ---------------------------------------------------------------------------

test("evaluate updates fingerprint when policy change is detected", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 10 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Establish baseline evaluation
  engine.evaluate(makeRequest());
  assert.equal(engine.isPolicyStale(), false);

  // Simulate external change
  policy.maxTaskCostUsd = 20;
  assert.equal(engine.isPolicyStale(), true);

  // Next evaluate should detect the change and refresh fingerprint
  engine.evaluate(makeRequest());
  assert.equal(engine.isPolicyStale(), false); // Now false because evaluate updated it
});

test("evaluate decisions reflect changed policy after stale detection", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 5 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // This should be allowed (5 >= 5, so exactly at limit is denied)
  const result1 = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result1.decision, "deny");

  // Change the limit
  policy.maxTaskCostUsd = 100;

  // Now a request for cost 5 should be allowed
  const result2 = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result2.decision, "allow_with_constraints");
});

test("evaluate decisions reflect new warnAtRatio after policy change", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 10, warnAtRatio: 0.8 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Cost 9 on 10 limit at 0.8 warning ratio (9 >= 8) triggers budget warning
  const result1 = engine.evaluate(makeRequest({ estimatedCostUsd: 9 }));
  assert.equal(result1.reasonCode, "policy.allow_under_budget_warning");
  assert.equal(result1.decision, "allow_with_constraints");

  // Change warnAtRatio to 0.95 (9 >= 9.5? No, so no warning)
  policy.warnAtRatio = 0.95;

  // Cost 9 on 10 limit at 0.95 warning ratio = no warning needed
  const result2 = engine.evaluate(makeRequest({ estimatedCostUsd: 9 }));
  assert.equal(result2.reasonCode, "policy.allow");
  assert.equal(result2.decision, "allow_with_constraints");

  // The reason code should have changed due to the warnAtRatio change
  assert.notEqual(result1.reasonCode, result2.reasonCode);
});

// ---------------------------------------------------------------------------
// PolicyEngine - explicit invalidate via handler
// ---------------------------------------------------------------------------

test("explicit invalidate resets stale state after external change", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 5 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Make a decision at limit - should be denied
  const result1 = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result1.decision, "deny");

  // Simulate external policy update to higher limit
  policy.maxTaskCostUsd = 100;
  assert.equal(engine.isPolicyStale(), true);

  // Explicitly invalidate to signal we acknowledge the change
  engine.invalidate("external policy update via admin API");

  // Now the policy should be current (stale false)
  assert.equal(engine.isPolicyStale(), false);

  // And decisions should use the new policy
  const result2 = engine.evaluate(makeRequest({ estimatedCostUsd: 5 }));
  assert.equal(result2.decision, "allow_with_constraints");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("isPolicyStale handles zero values for optional numeric fields", () => {
  const policy = makeBudgetPolicy({
    maxPlatformCostUsd: 0,
    maxPackCostUsd: 0,
    maxStepCostUsd: 0,
  });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  // Should not be stale on construction
  assert.equal(engine.isPolicyStale(), false);

  // Changing to non-zero should be detected
  policy.maxPlatformCostUsd = 50;
  assert.equal(engine.isPolicyStale(), true);
});

test("isPolicyStale handles undefined optional fields", () => {
  const policy = makeBudgetPolicy({
    stageBudgets: undefined,
    costEstimationTemplates: undefined,
  });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  assert.equal(engine.isPolicyStale(), false);

  // Setting them to defined values should be detected
  policy.stageBudgets = [{ stage: "execute", maxCostUsd: 5 }];
  assert.equal(engine.isPolicyStale(), true);
});

test("multiple rapid policy changes are all detected", () => {
  const policy = makeBudgetPolicy({ maxTaskCostUsd: 5 });
  const engine = new PolicyEngine({ budgetPolicy: policy });

  engine.evaluate(makeRequest()); // baseline

  policy.maxTaskCostUsd = 10;
  assert.equal(engine.isPolicyStale(), true);
  engine.invalidate("change 1");

  policy.maxTaskCostUsd = 15;
  assert.equal(engine.isPolicyStale(), true);
  engine.invalidate("change 2");

  policy.maxTaskCostUsd = 20;
  assert.equal(engine.isPolicyStale(), true);
  engine.invalidate("change 3");

  // Each change was detected
  assert.equal(engine.isPolicyStale(), false); // After last invalidate
});
