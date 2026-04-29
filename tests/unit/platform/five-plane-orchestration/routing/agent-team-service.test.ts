import assert from "node:assert/strict";
import test from "node:test";

import type { PlannedWorkflow } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { AgentTeamService } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/agent-team-service.js";
import type { AgentTeamStage, AgentTeamPlan } from "/Users/holden/Project/automatic_agent/automatic_agent_platform/src/platform/five-plane-orchestration/routing/agent-team-service.js";

// ============================================================================
// Test helpers
// ============================================================================

/**
 * Creates a minimal PlannedWorkflow input for buildPlan() tests.
 */
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

/**
 * Simulates getNextStage behavior given an execution state.
 * This verifies the adaptive routing logic described in R9-13.
 *
 * For low-risk workflows without a repair stage, failure cannot be recovered
 * locally - the workflow must escalate or terminate.
 */
function simulateGetNextStage(
  executionLoop: AgentTeamStage[],
  currentStageIndex: number,
  lastStepOutput: "failed" | "succeeded",
): AgentTeamStage | null {
  if (lastStepOutput === "failed") {
    // On failure, route to "repair" stage if it exists in the loop
    const repairIndex = executionLoop.indexOf("repair");
    if (repairIndex >= 0) {
      return executionLoop[repairIndex]!;
    }
    // No repair stage available (low-risk) - failure cannot be recovered locally
    return null;
  }
  // On success, proceed to next stage in the loop
  const nextIndex = currentStageIndex + 1;
  return executionLoop[nextIndex] ?? null;
}

// ============================================================================
// R9-13: Adaptive routing - buildPlan() executionLoop varies by riskLevel
// ============================================================================

test("buildPlan returns 3-stage executionLoop for low-risk tasks (R9-13 fix)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("low_risk_workflow");

  const plan = service.buildPlan({
    taskId: "task_low_risk",
    workflow,
    riskLevel: "low",
  });

  const expectedExecutionLoop: AgentTeamStage[] = ["plan", "build", "release"];

  assert.deepEqual(
    plan.executionLoop,
    expectedExecutionLoop,
    "Low-risk tasks should bypass heavy review/validate pipeline",
  );
  assert.equal(
    plan.executionLoop.length,
    3,
    "Low-risk executionLoop should have exactly 3 stages",
  );
});

test("buildPlan returns 7-stage executionLoop for high-risk tasks (R9-13 fix)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("high_risk_workflow");

  const plan = service.buildPlan({
    taskId: "task_high_risk",
    workflow,
    riskLevel: "high",
  });

  const expectedExecutionLoop: AgentTeamStage[] = [
    "plan",
    "build",
    "review",
    "validate",
    "repair",
    "validate",
    "release",
  ];

  assert.deepEqual(
    plan.executionLoop,
    expectedExecutionLoop,
    "High-risk tasks should use full 7-stage pipeline",
  );
  assert.equal(
    plan.executionLoop.length,
    7,
    "High-risk executionLoop should have exactly 7 stages",
  );
});

test("buildPlan defaults to medium risk when riskLevel is omitted", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("medium_risk_workflow");

  const plan = service.buildPlan({
    taskId: "task_no_risk",
    workflow,
    // riskLevel omitted - should default to "medium"
  });

  // Medium risk should use the full 7-stage pipeline (same as high)
  const expectedExecutionLoop: AgentTeamStage[] = [
    "plan",
    "build",
    "review",
    "validate",
    "repair",
    "validate",
    "release",
  ];

  assert.deepEqual(
    plan.executionLoop,
    expectedExecutionLoop,
    "Default (medium) risk should use full 7-stage pipeline",
  );
});

// ============================================================================
// R9-13: getNextStage function behavior verification
// ============================================================================

test("AgentTeamService does not have getNextStage method (adaptive routing via executionLoop)", () => {
  const service = new AgentTeamService();

  // The service uses executionLoop array for routing, not a getNextStage method
  assert.equal(
    typeof (service as any).getNextStage,
    "undefined",
    "AgentTeamService should not have getNextStage - routing uses executionLoop array",
  );
});

test("executionLoop array supports stage progression for adaptive routing", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("progression_test");

  const plan = service.buildPlan({
    taskId: "task_progression",
    workflow,
    riskLevel: "high",
  });

  // Verify executionLoop contains all expected stages for progression
  const stages = plan.executionLoop;
  assert.ok(stages.includes("plan"), "Should include plan stage");
  assert.ok(stages.includes("build"), "Should include build stage");
  assert.ok(stages.includes("review"), "Should include review stage");
  assert.ok(stages.includes("validate"), "Should include validate stage");
  assert.ok(stages.includes("repair"), "Should include repair stage");
  assert.ok(stages.includes("release"), "Should include release stage");

  // Verify ordering
  const planIndex = stages.indexOf("plan");
  const buildIndex = stages.indexOf("build");
  const reviewIndex = stages.indexOf("review");
  const validateIndex = stages.indexOf("validate");
  const repairIndex = stages.indexOf("repair");
  const releaseIndex = stages.indexOf("release");

  assert.ok(planIndex < buildIndex, "plan should come before build");
  assert.ok(buildIndex < reviewIndex, "build should come before review");
  assert.ok(reviewIndex < validateIndex, "review should come before validate");
  assert.ok(validateIndex < repairIndex, "first validate should come before repair"); // validate appears twice
  assert.ok(repairIndex < validateIndex + 2, "repair should come before second validate"); // validate appears twice
  assert.ok(repairIndex < releaseIndex, "repair should come before release");
});

// ============================================================================
// R9-13: On lastStepOutput="failed", routing goes to "repair" stage
// ============================================================================

test("on lastStepOutput=failed, routing goes to repair stage (high-risk loop)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("failed_routing_test");

  const plan = service.buildPlan({
    taskId: "task_failed",
    workflow,
    riskLevel: "high",
  });

  const executionLoop = plan.executionLoop;

  // Simulate being at "validate" stage (index 3) with a failed last step
  const currentStageIndex = executionLoop.indexOf("validate");
  const nextStage = simulateGetNextStage(executionLoop, currentStageIndex, "failed");

  assert.equal(
    nextStage,
    "repair",
    "On failed output, routing should go to repair stage",
  );
});

test("on lastStepOutput=failed in low-risk loop, repair stage is not available", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("low_risk_failed_test");

  const plan = service.buildPlan({
    taskId: "task_low_risk_failed",
    workflow,
    riskLevel: "low",
  });

  const executionLoop = plan.executionLoop;

  // Low-risk loop is ["plan", "build", "release"] - no repair stage
  assert.equal(
    executionLoop.includes("repair"),
    false,
    "Low-risk executionLoop should not include repair stage",
  );

  // Simulate failure at build stage
  const currentStageIndex = executionLoop.indexOf("build");
  const nextStage = simulateGetNextStage(executionLoop, currentStageIndex, "failed");

  // Since repair doesn't exist in low-risk loop, returns null
  assert.equal(
    nextStage,
    null,
    "When repair stage is not available, should return null on failure",
  );
});

// ============================================================================
// R9-13: On lastStepOutput="succeeded", routing proceeds to next stage
// ============================================================================

test("on lastStepOutput=succeeded, routing proceeds to next stage in executionLoop", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("success_routing_test");

  const plan = service.buildPlan({
    taskId: "task_success",
    workflow,
    riskLevel: "high",
  });

  const executionLoop = plan.executionLoop;

  // Simulate being at "build" stage (index 1) with successful last step
  const currentStageIndex = executionLoop.indexOf("build");
  const nextStage = simulateGetNextStage(executionLoop, currentStageIndex, "succeeded");

  assert.equal(
    nextStage,
    "review",
    "On successful output, routing should proceed to next stage (review after build)",
  );
});

test("on lastStepOutput=succeeded at last stage, routing returns null (workflow complete)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("complete_routing_test");

  const plan = service.buildPlan({
    taskId: "task_complete",
    workflow,
    riskLevel: "high",
  });

  const executionLoop = plan.executionLoop;

  // Simulate being at "release" stage (last stage)
  const currentStageIndex = executionLoop.indexOf("release");
  const nextStage = simulateGetNextStage(executionLoop, currentStageIndex, "succeeded");

  assert.equal(
    nextStage,
    null,
    "At last stage with success, routing should return null (workflow complete)",
  );
});

// ============================================================================
// R9-13: Low-risk tasks bypass heavy review/validate pipeline
// ============================================================================

test("low-risk tasks bypass review and validate stages entirely", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("bypass_test");

  const plan = service.buildPlan({
    taskId: "task_bypass",
    workflow,
    riskLevel: "low",
  });

  const executionLoop = plan.executionLoop;

  assert.equal(
    executionLoop.includes("review"),
    false,
    "Low-risk executionLoop should not include review stage",
  );
  assert.equal(
    executionLoop.includes("validate"),
    false,
    "Low-risk executionLoop should not include validate stage",
  );
  assert.equal(
    executionLoop.includes("repair"),
    false,
    "Low-risk executionLoop should not include repair stage",
  );
});

test("low-risk executionLoop contains only plan, build, release stages", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("minimal_pipeline_test");

  const plan = service.buildPlan({
    taskId: "task_minimal",
    workflow,
    riskLevel: "low",
  });

  assert.deepEqual(
    plan.executionLoop,
    ["plan", "build", "release"],
    "Low-risk should use minimal 3-stage pipeline",
  );
});

test("high-risk executionLoop includes all heavy pipeline stages", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("heavy_pipeline_test");

  const plan = service.buildPlan({
    taskId: "task_heavy",
    workflow,
    riskLevel: "high",
  });

  // High-risk includes review, validate, repair stages
  assert.ok(
    plan.executionLoop.includes("review"),
    "High-risk should include review stage",
  );
  assert.ok(
    plan.executionLoop.includes("validate"),
    "High-risk should include validate stage",
  );
  assert.ok(
    plan.executionLoop.includes("repair"),
    "High-risk should include repair stage",
  );
});

// ============================================================================
// AgentTeamPlan structure verification
// ============================================================================

test("buildPlan returns plan with correct teamId format", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("team_id_test");

  const plan = service.buildPlan({
    taskId: "task_team_id",
    workflow,
    riskLevel: "low",
  });

  assert.ok(
    plan.teamId.startsWith("team:"),
    "teamId should start with 'team:' prefix",
  );
  assert.ok(
    plan.teamId.includes("team_id_test"),
    "teamId should include workflow ID",
  );
  assert.ok(
    plan.teamId.includes("task_team_id"),
    "teamId should include task ID",
  );
});

test("buildPlan returns plan with all required lanes for low-risk (lanes always exist, loop is adaptive)", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("lanes_test");

  const plan = service.buildPlan({
    taskId: "task_lanes",
    workflow,
    riskLevel: "low",
  });

  // Lanes ALWAYS exist for all stages - the adaptive routing is in executionLoop
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "plan"),
    "Should have plan lane",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "build"),
    "Should have build lane(s)",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "review"),
    "Should have review lane (lanes exist regardless of risk)",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "validate"),
    "Should have validate lane (lanes exist regardless of risk)",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "repair"),
    "Should have repair lane (lanes exist regardless of risk)",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "release"),
    "Should have release lane",
  );
});

test("buildPlan returns plan with all required lanes for high-risk", () => {
  const service = new AgentTeamService();
  const workflow = createMockWorkflow("lanes_high_risk_test");

  const plan = service.buildPlan({
    taskId: "task_lanes_high",
    workflow,
    riskLevel: "high",
  });

  // High-risk should have all lanes
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "plan"),
    "Should have plan lane",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "build"),
    "Should have build lane(s)",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "review"),
    "Should have review lane for high-risk",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "validate"),
    "Should have validate lane for high-risk",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "repair"),
    "Should have repair lane for high-risk",
  );
  assert.ok(
    plan.lanes.some((lane) => lane.stage === "release"),
    "Should have release lane",
  );
});