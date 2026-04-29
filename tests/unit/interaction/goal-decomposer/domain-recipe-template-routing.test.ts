import assert from "node:assert/strict";
import test from "node:test";

import { GoalDecompositionService, type Goal } from "../../../../src/interaction/goal-decomposer/index.js";
import type { DomainRecipe } from "../../../../src/domains/recipes/index.js";

test("GoalDecompositionService uses DomainRecipe matches before regex template fallback", async () => {
  const domainRecipes: readonly DomainRecipe[] = [
    {
      recipeId: "engineering_ops.gray-rollout",
      domainId: "engineering_ops",
      archetype: "realtime",
      name: "Gray rollout recipe",
      description: "Supports gray rollout and release cutover planning.",
      triggerPhrases: ["灰度切流"],
      defaultWorkflowId: "release_launch.gray_rollout",
      defaultToolBundleIds: ["engineering_ops.bundle"],
    },
  ];
  const service = new GoalDecompositionService({
    domainRecipes,
    planGraphHarnessRuntime: {
      executeNext: ({ harnessRun }: { harnessRun: { harnessRunId: string } }) => ({
        nodeRun: {
          nodeRunId: `${harnessRun.harnessRunId}:node_run`,
          harnessRunId: harnessRun.harnessRunId,
        },
        nodeAttempt: {
          nodeAttemptId: `${harnessRun.harnessRunId}:node_attempt`,
        },
        receipt: {
          status: "succeeded",
        },
        events: [],
      }),
    } as never,
  });
  const goal: Goal = {
    goalId: "template_recipe_release",
    description: "准备灰度切流并观察回滚窗口",
    owner: "engineering",
    successCriteria: [],
    constraints: [],
    priority: "high",
  };

  const result = await service.decompose(goal);

  assert.equal(result.decompositionStrategy, "template");
  assert.ok(result.tasks.some((t) => t.domainId === "engineering_ops"));
  assert.ok(result.tasks.some((t) => t.domainId === "operations"));
});
