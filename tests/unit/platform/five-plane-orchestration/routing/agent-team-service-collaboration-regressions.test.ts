import assert from "node:assert/strict";
import test from "node:test";

import type { PlannedWorkflow } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { AgentTeamService } from "../../../../../src/platform/five-plane-orchestration/routing/agent-team-service.js";

function createMockWorkflow(
  workflowId = "test_workflow",
  stepCount = 1,
): PlannedWorkflow {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    stepId: `step_${index + 1}`,
    divisionId: "test_division",
    roleId: `role_${index + 1}`,
    inputKeys: index === 0 ? [] : [`output_${index}`],
    agentId: `agent_${index + 1}`,
    outputKey: `output_${index + 1}`,
    outputSchemaPath: null,
    timeoutMs: 60_000,
    maxAttempts: 1,
    dependsOnStepIds: index === 0 ? [] : [`step_${index}`],
    dependencyTypes: index === 0 ? {} : { [`step_${index}`]: "hard" as const },
  }));

  return {
    workflow: {
      workflowId,
      divisionId: "test_division",
      steps,
    },
    executionSteps: steps,
    planReason: "test.workflow",
    dependencyEdges: [],
  };
}

test("delegated AgentTeam plans require explicit parent depth context (R19-17)", () => {
  const service = new AgentTeamService();

  assert.throws(
    () =>
      service.buildPlan({
        taskId: "task_missing_parent_depth",
        workflow: createMockWorkflow(),
        riskLevel: "medium",
        parentRunId: "run-parent-1",
        parentAllowedTools: ["read", "glob", "grep"],
      }),
    /acp\.parent_depth_required/,
  );
});

test("delegated AgentTeam plans reject lanes that exceed parent permission subset (R19-17)", () => {
  const service = new AgentTeamService();

  assert.throws(
    () =>
      service.buildPlan({
        taskId: "task_permission_subset",
        workflow: createMockWorkflow(),
        riskLevel: "medium",
        parentRunId: "run-parent-1",
        parentDepth: 1,
        parentAllowedTools: ["read", "glob", "grep"],
      }),
    /acp\.permission_not_subset/,
  );
});

test("delegated AgentTeam plans reject chain depth beyond max 3 per path (R19-17)", () => {
  const service = new AgentTeamService();

  assert.throws(
    () =>
      service.buildPlan({
        taskId: "task_depth_limit",
        workflow: createMockWorkflow(),
        riskLevel: "medium",
        parentRunId: "run-parent-1",
        parentDepth: 3,
        parentAllowedTools: [
          "read",
          "glob",
          "grep",
          "repo_map",
          "apply_patch",
          "diagnostics",
        ],
      }),
    /delegation\.depth_exceeded/,
  );
});

test("high-risk AgentTeam execution loop always includes repair and second validate even for single-step workflows (R19-26)", () => {
  const service = new AgentTeamService();

  const plan = service.buildPlan({
    taskId: "task_high_risk_single_step",
    workflow: createMockWorkflow("high_risk_single_step", 1),
    riskLevel: "high",
  });

  assert.deepEqual(
    plan.executionLoop,
    ["plan", "build", "review", "validate", "repair", "validate", "release"],
  );
});

test("high-risk AgentTeam execution loop expands review pressure as workflow breadth grows (R19-26)", () => {
  const service = new AgentTeamService();

  const plan = service.buildPlan({
    taskId: "task_high_risk_multi_step",
    workflow: createMockWorkflow("high_risk_multi_step", 5),
    riskLevel: "high",
  });

  assert.deepEqual(
    plan.executionLoop,
    [
      "plan",
      "build",
      "review",
      "validate",
      "repair",
      "validate",
      "review",
      "validate",
      "review",
      "validate",
      "release",
    ],
  );
});
