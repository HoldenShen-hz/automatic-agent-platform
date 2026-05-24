import assert from "node:assert/strict";
import test from "node:test";

import type { PlannedWorkflow } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { AgentTeamService } from "../../../../../src/platform/five-plane-orchestration/routing/agent-team-service.js";

function createMockWorkflow(workflowId = "test_workflow"): PlannedWorkflow {
  return {
    workflow: {
      workflowId,
      divisionId: "test_division",
      steps: [
        {
          stepId: "step_1",
          divisionId: "test_division",
          roleId: "coder",
          inputKeys: [],
          outputKey: "output_1",
          outputSchemaPath: null,
          timeoutMs: 60_000,
          maxAttempts: 1,
          dependsOnStepIds: [],
          dependencyTypes: {},
        },
      ],
    },
    executionSteps: [
      {
        stepId: "step_1",
        divisionId: "test_division",
        roleId: "coder",
        inputKeys: [],
        agentId: "agent_coder",
        outputKey: "output_1",
        outputSchemaPath: null,
        dependsOnStepIds: [],
        dependencyTypes: {},
        timeoutMs: 60_000,
        maxAttempts: 1,
      },
    ],
    planReason: "test.workflow",
    dependencyEdges: [],
  };
}

test("buildPlan populates §19.5 lane invariant fields (R19-21)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("lane_invariants_workflow");

  const plan = service.buildPlan({
    taskId: "task_lane_invariants",
    workflow,
    riskLevel: "high",
    parentRunId: "run-parent-1",
    parentDepth: 1,
    parentAllowedTools: [
      "read",
      "glob",
      "grep",
      "repo_map",
      "apply_patch",
      "diagnostics",
    ],
    budget: 600,
  });

  assert.ok(plan.lanes.length > 0, "Plan should contain lanes");

  for (const lane of plan.lanes) {
    assert.equal(typeof lane.depth, "number");
    assert.equal(lane.depth, 2, "delegated lanes should advance chain depth by one");
    assert.ok(lane.budgetRemaining != null);
    assert.ok(lane.correlationId != null);
    assert.ok(lane.traceId != null);
    assert.equal(typeof lane.budgetRemaining, "number");
    assert.ok(lane.budgetRemaining <= 600, "budgetRemaining should stay within parent budget");
    assert.equal(typeof lane.correlationId, "string");
    assert.ok(lane.correlationId.length > 0, "correlationId should be populated");
    assert.equal(lane.parentRunId, "run-parent-1");
    assert.equal(lane.domainId, "lane_invariants_workflow");
    assert.equal(lane.riskLevel, 75, "high risk should map to numeric invariant value");
    assert.equal(typeof lane.traceId, "string");
    assert.ok(lane.traceId.length > 0, "traceId should be populated");
  }
});
