import assert from "node:assert/strict";
import test from "node:test";

import * as improveRollout from "../../../../../src/platform/orchestration/improve-rollout/index.js";

test("improve-rollout index exports AutoRollbackService", () => {
  assert.ok(improveRollout.AutoRollbackService !== undefined);
  assert.ok(typeof improveRollout.AutoRollbackService === "function");
});

test("improve-rollout index exports AutonomyBoundaryPolicy", () => {
  assert.ok(improveRollout.AutonomyBoundaryPolicy !== undefined);
  assert.ok(typeof improveRollout.AutonomyBoundaryPolicy === "function");
});

test("improve-rollout index exports CanaryTrafficRouter", () => {
  assert.ok(improveRollout.CanaryTrafficRouter !== undefined);
  assert.ok(typeof improveRollout.CanaryTrafficRouter === "function");
});

test("improve-rollout index exports GuardrailEvaluator", () => {
  assert.ok(improveRollout.GuardrailEvaluator !== undefined);
  assert.ok(typeof improveRollout.GuardrailEvaluator === "function");
});

test("improve-rollout index exports ImprovementCandidateRegistry", () => {
  assert.ok(improveRollout.ImprovementCandidateRegistry !== undefined);
  assert.ok(typeof improveRollout.ImprovementCandidateRegistry === "function");
});

test("improve-rollout index exports PolicyRolloutService", () => {
  assert.ok(improveRollout.PolicyRolloutService !== undefined);
  assert.ok(typeof improveRollout.PolicyRolloutService === "function");
});

test("improve-rollout index exports RolloutScheduler", () => {
  assert.ok(improveRollout.RolloutScheduler !== undefined);
  assert.ok(typeof improveRollout.RolloutScheduler === "function");
});

test("improve-rollout index exports RolloutStateMachine", () => {
  assert.ok(improveRollout.RolloutStateMachine !== undefined);
  assert.ok(typeof improveRollout.RolloutStateMachine === "function");
});

test("improve-rollout index exports StrategyVersion", () => {
  assert.ok(improveRollout.StrategyVersion !== undefined);
});

test("improve-rollout index exports AutonomyTarget type", () => {
  assert.ok(improveRollout.AutonomyTarget !== undefined);
});

test("improve-rollout index exports RolloutMetrics type", () => {
  assert.ok(improveRollout.RolloutMetrics !== undefined);
});

test("improve-rollout index exports createStrategyVersion function", () => {
  assert.ok(improveRollout.createStrategyVersion !== undefined);
  assert.ok(typeof improveRollout.createStrategyVersion === "function");
});

test("improve-rollout index exports CANARY_ROLLOUT_STATUSES constant", () => {
  assert.ok(improveRollout.CANARY_ROLLOUT_STATUSES !== undefined);
  assert.ok(Array.isArray(improveRollout.CANARY_ROLLOUT_STATUSES));
});

test("improve-rollout index exports PROGRESIVE_ROLLOUT_STATUSES constant", () => {
  assert.ok(improveRollout.PROGRESIVE_ROLLOUT_STATUSES !== undefined);
  assert.ok(Array.isArray(improveRollout.PROGRESIVE_ROLLOUT_STATUSES));
});

test("improve-rollout index exports ImprovementCandidate type", () => {
  assert.ok(improveRollout.ImprovementCandidate !== undefined);
});

test("improve-rollout index exports RolloutRecord type", () => {
  assert.ok(improveRollout.RolloutRecord !== undefined);
});
