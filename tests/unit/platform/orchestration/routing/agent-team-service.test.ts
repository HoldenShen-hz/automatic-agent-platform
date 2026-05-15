import assert from "node:assert/strict";
import test from "node:test";

import { AgentTeamService, type AgentTeamPlanInput, type AgentTeamStage, type AgentModelTier, type AgentTeamLane } from "../../../../../src/platform/five-plane-orchestration/routing/agent-team-service.js";
import type { PlannedWorkflow } from "../../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function createMockWorkflow(steps: any[] = []): PlannedWorkflow {
  return {
    workflow: {
      workflowId: "wf_test",
      divisionId: "division_1",
      steps: steps.length > 0 ? steps : [{
        stepId: "step_1",
        roleId: "executor",
        outputKey: "result",
        timeoutMs: 30000,
        maxAttempts: 3,
        dependsOnStepIds: [],
        inputKeys: [],
        divisionId: "division_1",
        agentId: "agent_executor",
      }],
    },
    executionSteps: steps.length > 0 ? steps : [{
      stepId: "step_1",
      roleId: "executor",
      outputKey: "result",
      timeoutMs: 30000,
      maxAttempts: 3,
      dependsOnStepIds: [],
      inputKeys: [],
      divisionId: "division_1",
      agentId: "agent_executor",
      dependencyTypes: {},
    }],
    dependencyEdges: [],
    planReason: "test",
  };
}

test("AgentTeamService can be instantiated", () => {
  const service = new AgentTeamService();
  assert.ok(service instanceof AgentTeamService);
});

test("AgentTeamService.buildPlan creates plan with default risk level", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  assert.equal(plan.taskId, "task_1");
  assert.equal(plan.riskLevel, "medium");
  assert.ok(plan.lanes.length > 0);
});

test("AgentTeamService.buildPlan creates plan with explicit risk level", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
    riskLevel: "high",
  };

  const plan = service.buildPlan(input);

  assert.equal(plan.riskLevel, "high");
});

test("AgentTeamService.buildPlan includes planner lane", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  const plannerLane = plan.lanes.find((l: AgentTeamLane) => l.stage === "plan");
  assert.ok(plannerLane);
  assert.equal(plannerLane!.ownerRoleId, "workflow_planner");
  assert.equal(plannerLane!.agentId, "agent_workflow_planner");
});

test("AgentTeamService.buildPlan includes reviewer lane", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  const reviewerLane = plan.lanes.find((l: AgentTeamLane) => l.stage === "review");
  assert.ok(reviewerLane);
  assert.equal(reviewerLane!.ownerRoleId, "reviewer");
});

test("AgentTeamService.buildPlan maps workflow steps to build lanes", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow([
    {
      stepId: "step_1",
      roleId: "coder",
      outputKey: "code",
      timeoutMs: 30000,
      maxAttempts: 3,
      dependsOnStepIds: [],
      inputKeys: [],
      divisionId: "division_1",
      agentId: "agent_coder",
      dependencyTypes: {},
    },
    {
      stepId: "step_2",
      roleId: "tester",
      outputKey: "tests",
      timeoutMs: 30000,
      maxAttempts: 3,
      dependsOnStepIds: ["step_1"],
      inputKeys: ["code"],
      divisionId: "division_1",
      agentId: "agent_tester",
      dependencyTypes: { step_1: "hard" },
    },
  ]);
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow,
  };

  const plan = service.buildPlan(input);

  const buildLanes = plan.lanes.filter((l: AgentTeamLane) => l.stage === "build");
  assert.equal(buildLanes.length, 2);
  assert.ok(buildLanes.some((l: AgentTeamLane) => l.ownerRoleId === "coder"));
  assert.ok(buildLanes.some((l: AgentTeamLane) => l.ownerRoleId === "tester"));
});

test("AgentTeamService.buildPlan sets correct model tiers for high risk review", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
    riskLevel: "high",
  };

  const plan = service.buildPlan(input);

  const reviewLane = plan.lanes.find((l: AgentTeamLane) => l.stage === "review");
  assert.equal(reviewLane?.modelTier, "strong");
});

test("AgentTeamService.buildPlan sets cheap model for build in low risk", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
    riskLevel: "low",
  };

  const plan = service.buildPlan(input);

  const buildLanes = plan.lanes.filter((l: AgentTeamLane) => l.stage === "build");
  for (const lane of buildLanes) {
    assert.equal(lane.modelTier, "cheap");
  }
});

test("AgentTeamService.buildPlan includes repair lane for steps with compensation", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow([{
    stepId: "step_1",
    roleId: "executor",
    outputKey: "result",
    timeoutMs: 30000,
    maxAttempts: 3,
    dependsOnStepIds: [],
    inputKeys: [],
    divisionId: "division_1",
    agentId: "agent_executor",
    dependencyTypes: {},
    compensationModel: { type: "rollback" },
  }]);
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow,
  };

  const plan = service.buildPlan(input);

  const repairLanes = plan.lanes.filter((l: AgentTeamLane) => l.stage === "repair");
  assert.ok(repairLanes.length > 0);
});

test("AgentTeamService.buildPlan assigns validate lane", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  const validateLane = plan.lanes.find((l: AgentTeamLane) => l.stage === "validate");
  assert.ok(validateLane);
});

test("AgentTeamService.buildPlan assigns release lane", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_1",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  const releaseLane = plan.lanes.find((l: AgentTeamLane) => l.stage === "release");
  assert.ok(releaseLane);
});

test("AgentTeamService.buildPlan sets teamId with correct format", () => {
  const service = new AgentTeamService();
  const input: AgentTeamPlanInput = {
    taskId: "task_abc123",
    workflow: createMockWorkflow(),
  };

  const plan = service.buildPlan(input);

  assert.ok(plan.teamId.startsWith("team:"));
  assert.ok(plan.teamId.includes("wf_test"));
  assert.ok(plan.teamId.includes("task_abc123"));
});

test("AgentTeamStage type accepts all valid values", () => {
  const stages: AgentTeamStage[] = ["plan", "build", "review", "validate", "repair", "release"];
  for (const stage of stages) {
    assert.ok(["plan", "build", "review", "validate", "repair", "release"].includes(stage));
  }
});

test("AgentModelTier type accepts all valid values", () => {
  const tiers: AgentModelTier[] = ["cheap", "standard", "strong"];
  for (const tier of tiers) {
    assert.ok(["cheap", "standard", "strong"].includes(tier));
  }
});
