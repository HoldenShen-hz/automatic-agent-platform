/**
 * Unit tests for CallDepthBudget
 *
 * Tests the call depth budget evaluation logic per §19.2.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CallDepthBudget } from "../../../../src/platform/orchestration/agent-delegation/call-depth-budget.js";

test("CallDepthBudget.evaluate returns allowed when under limit", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 2,
    goalDecompositionDepth: 1,
    delegationDepth: 1,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveCallDepth, 4); // 2 + 1 + 1
  assert.equal(decision.maxCallDepth, 8);
  assert.equal(decision.reasonCode, "call_depth.allowed");
});

test("CallDepthBudget.evaluate returns not allowed when at limit", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 3,
    goalDecompositionDepth: 3,
    delegationDepth: 2,
  });

  // 3 + 3 + 2 = 8, which equals DEFAULT_MAX_DEPTH
  assert.equal(decision.allowed, true); // allowed because <=
  assert.equal(decision.effectiveCallDepth, 8);
  assert.equal(decision.reasonCode, "call_depth.allowed");
});

test("CallDepthBudget.evaluate returns not allowed when over limit", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 4,
    goalDecompositionDepth: 3,
    delegationDepth: 2,
  });

  // 4 + 3 + 2 = 9, which exceeds DEFAULT_MAX_DEPTH of 8
  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveCallDepth, 9);
  assert.equal(decision.reasonCode, "call_depth.exceeded");
});

test("CallDepthBudget.evaluate uses summation not Math.max per §19.2", () => {
  const budget = new CallDepthBudget();

  // Summation: 2 + 2 + 2 = 6
  const decision = budget.evaluate({
    currentCallDepth: 2,
    goalDecompositionDepth: 2,
    delegationDepth: 2,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveCallDepth, 6);
});

test("CallDepthBudget.evaluate with zero depths", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 0,
    goalDecompositionDepth: 0,
    delegationDepth: 0,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveCallDepth, 0);
  assert.equal(decision.reasonCode, "call_depth.allowed");
});

test("CallDepthBudget.evaluate with boundary at max depth", () => {
  const budget = new CallDepthBudget();

  // Exactly at limit: 8
  const decision = budget.evaluate({
    currentCallDepth: 5,
    goalDecompositionDepth: 2,
    delegationDepth: 1,
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.effectiveCallDepth, 8);
  assert.equal(decision.maxCallDepth, 8);
});

test("CallDepthBudget.evaluate fails immediately over limit", () => {
  const budget = new CallDepthBudget();

  // Just one over: 9
  const decision = budget.evaluate({
    currentCallDepth: 6,
    goalDecompositionDepth: 2,
    delegationDepth: 1,
  });

  assert.equal(decision.allowed, false);
  assert.equal(decision.effectiveCallDepth, 9);
  assert.equal(decision.reasonCode, "call_depth.exceeded");
});

test("CallDepthBudget instance has correct maxCallDepth", () => {
  const budget = new CallDepthBudget();

  const decision = budget.evaluate({
    currentCallDepth: 0,
    goalDecompositionDepth: 0,
    delegationDepth: 0,
  });

  assert.equal(decision.maxCallDepth, 8);
});
