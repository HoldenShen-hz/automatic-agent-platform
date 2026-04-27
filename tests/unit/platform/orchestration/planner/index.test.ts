import assert from "node:assert/strict";
import test from "node:test";

import * as orchestrationPlanner from "../../../../../src/platform/orchestration/planner/index.js";

test("planner module exports TaskDecompositionService", () => {
  assert.ok("TaskDecompositionService" in orchestrationPlanner);
});

test("planner module exports PlanBuilder", () => {
  assert.ok("PlanBuilder" in orchestrationPlanner);
});

test("planner module exports PlanEvaluator", () => {
  assert.ok("PlanEvaluator" in orchestrationPlanner);
});

test("planner module exports ReplanningService", () => {
  assert.ok("ReplanningService" in orchestrationPlanner);
});

test("planner module exports PlanRepository", () => {
  assert.ok("PlanRepository" in orchestrationPlanner);
});

test("planner module exports PlanDagValidator", () => {
  assert.ok("PlanDagValidator" in orchestrationPlanner);
});

test("planner module exports PlanStrategySelector", () => {
  assert.ok("PlanStrategySelector" in orchestrationPlanner);
});

test("planner module exports PlanSchema and PlanStepSchema", () => {
  assert.ok("PlanSchema" in orchestrationPlanner);
  assert.ok("PlanStepSchema" in orchestrationPlanner);
});