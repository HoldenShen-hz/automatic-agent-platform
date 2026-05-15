import test from "node:test";
import assert from "node:assert/strict";

import { PlanSchema } from "../../../../../src/platform/five-plane-orchestration/oapeflir/types/plan.js";

test("PlanSchema accepts graph-native fields alongside legacy steps", () => {
  const plan = PlanSchema.parse({
    planId: "plan_graph_1",
    taskId: "task_graph_1",
    version: 1,
    assessmentRef: "assessment:task_graph_1:1",
    strategy: "goal_driven",
    steps: [
      {
        stepId: "step_1",
        action: "read",
        timeout: 1000,
      },
    ],
    nodes: [
      {
        nodeId: "node_1",
        nodeType: "tool",
        inputRefs: [],
        riskClass: "high",
        budgetIntent: {
          amount: 3,
          currency: "USD",
          resourceKinds: ["compute"],
        },
        sideEffectProfile: {
          mayCommitExternalEffect: true,
          reversible: false,
        },
        timeoutMs: 1000,
      },
    ],
    edges: [
      {
        edgeId: "edge_1",
        fromNodeId: "node_1",
        toNodeId: "node_1",
        condition: { type: "always" },
        dependencyType: "soft",
      },
    ],
    entryNodeIds: ["node_1"],
    graphConstraints: {
      joinStrategy: "all",
    },
    createdAt: 3,
  });

  assert.equal(plan.nodes[0]?.nodeId, "node_1");
  assert.equal(plan.edges[0]?.dependencyType, "soft");
  assert.deepEqual(plan.entryNodeIds, ["node_1"]);
  assert.deepEqual(plan.graphConstraints, { joinStrategy: "all" });
});
