import assert from "node:assert/strict";
import test from "node:test";

// OAPEFLIR Improve-Rollout barrel test - imports from the improve-rollout module index
import * as ImproveRollout from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/index.js";

test("ImproveRollout module is exported", () => {
  assert.ok(ImproveRollout !== undefined);
  assert.equal(typeof ImproveRollout, "object");
});

test("AutoRollbackService is exported", () => {
  assert.equal(typeof ImproveRollout.AutoRollbackService, "function");
});

test("AutonomyBoundaryPolicy is exported", () => {
  assert.equal(typeof ImproveRollout.AutonomyBoundaryPolicy, "function");
});

test("CanaryTrafficRouter is exported", () => {
  assert.equal(typeof ImproveRollout.CanaryTrafficRouter, "function");
});

test("GuardrailEvaluator is exported", () => {
  assert.equal(typeof ImproveRollout.GuardrailEvaluator, "function");
});

test("ImprovementCandidateRegistry is exported", () => {
  assert.equal(typeof ImproveRollout.ImprovementCandidateRegistry, "function");
});

test("PolicyRolloutService is exported", () => {
  assert.equal(typeof ImproveRollout.PolicyRolloutService, "function");
});

test("ReleasePolicy is exported", () => {
  assert.ok(ImproveRollout.ReleasePolicy !== undefined);
});

test("RolloutScheduler is exported", () => {
  assert.equal(typeof ImproveRollout.RolloutScheduler, "function");
});

test("RolloutStateMachine is exported", () => {
  assert.equal(typeof ImproveRollout.RolloutStateMachine, "function");
});

test("StrategyVersioning is exported", () => {
  assert.equal(typeof ImproveRollout.StrategyVersioning, "function");
});

test("AutonomyBoundary type is exported", () => {
  assert.ok(ImproveRollout.AutonomyBoundary !== undefined);
});

test("RolloutStage type is exported", () => {
  assert.ok(ImproveRollout.RolloutStage !== undefined);
});

test("RolloutResult type is exported", () => {
  assert.ok(ImproveRollout.RolloutResult !== undefined);
});

test("ImprovementCandidate type is exported", () => {
  assert.ok(ImproveRollout.ImprovementCandidate !== undefined);
});

test("GuardrailCheck type is exported", () => {
  assert.ok(ImproveRollout.GuardrailCheck !== undefined);
});

test("RollbackTrigger type is exported", () => {
  assert.ok(ImproveRollout.RollbackTrigger !== undefined);
});

test("ReleasePolicySchema is exported", () => {
  assert.ok(ImproveRollout.ReleasePolicySchema !== undefined);
});

test("ImprovementCandidateSchema is exported", () => {
  assert.ok(ImproveRollout.ImprovementCandidateSchema !== undefined);
});

test("GuardrailEvaluatorSchema is exported", () => {
  assert.ok(ImproveRollout.GuardrailEvaluatorSchema !== undefined);
});

test("CanaryRouterSchema is exported", () => {
  assert.ok(ImproveRollout.CanaryRouterSchema !== undefined);
});

test("RolloutStateMachineSchema is exported", () => {
  assert.ok(ImproveRollout.RolloutStateMachineSchema !== undefined);
});

test("StrategyVersioningSchema is exported", () => {
  assert.ok(ImproveRollout.StrategyVersioningSchema !== undefined);
});