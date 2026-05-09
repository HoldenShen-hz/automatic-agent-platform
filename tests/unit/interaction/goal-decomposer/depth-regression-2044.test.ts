import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService } from "../../../../src/interaction/goal-decomposer/index.js";

test("GoalDecompositionService derives decomposition depth from the dependency graph", async () => {
  const service = new GoalDecompositionService({ maxDepth: 2 });
  const result = await service.decompose("发起春季营销 campaign 并追踪 ROI");

  assert.equal(result.depthUsed, 3);
  assert.equal(result.maxDepthReached, true);
  assert.equal(result.requiresHumanReview, true);
  assert.ok(
    result.taskGraphDraft.validationMessages.includes("goal_decomposer.max_depth_reached:3:2"),
  );
});
