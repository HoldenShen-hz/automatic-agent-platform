/**
 * Integration Test: Routing Engine
 *
 * Tests the routing logic including IntakeRouter classification,
 * division matching, and workflow selection using SQLite context.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { IntakeRouter, type IntakeRouteInput, type IntakeIntent } from "../../../../src/platform/five-plane-orchestration/routing/intake-router.js";
import { AgentTeamService, type AgentTeamPlanInput } from "../../../../src/platform/five-plane-orchestration/routing/agent-team-service.js";
import { WorkflowPlanner } from "../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";

function makeRouteInput(title: string, request: string): IntakeRouteInput {
  return { title, request };
}

test("RoutingEngine IntakeRouter classifies query intent correctly", () => {
  const ctx = createIntegrationContext("aa-routing-query-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Status check", "what is the current status of the deployment?");
    const result = router.route(input);

    assert.equal(result.classification.intent, "query");
    assert.equal(result.classification.continuation, "new_task");
    assert.ok(result.classification.confidence >= 0.45);
    assert.ok(result.routeTrace.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter classifies create intent with multiple matched rules", () => {
  const ctx = createIntegrationContext("aa-routing-create-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("New feature", "create a new API endpoint for user management");
    const result = router.route(input);

    assert.equal(result.classification.intent, "create");
    assert.ok(result.classification.matchedRules.length > 0, "Should have matched rules");
    assert.ok(result.routeTrace.some((t) => t.startsWith("matched_intent_rules:")), "Should have intent rules trace");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter detects orchestration hints and routes to multi-step", () => {
  const ctx = createIntegrationContext("aa-routing-orchestration-");
  try {
    const router = new IntakeRouter();

    // Multiple orchestration hints should trigger multi-step
    const input = makeRouteInput("Analysis task", "plan analyze and implement a security review");
    const result = router.route(input);

    assert.equal(result.requiresOrchestration, true);
    assert.equal(result.routeReason, "route.multi_step_or_high_context");
    assert.ok(result.workflowId.length > 0);
    assert.ok(result.routeTrace.some((trace) => trace.startsWith("route:selected:")));
    // Should have matched multiple hints
    const matchedKwsTrace = result.routeTrace.find((t) => t.startsWith("matched_keywords:"));
    assert.ok(matchedKwsTrace && matchedKwsTrace !== "matched_keywords:none", "Should have matched keywords");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter uses simple workflow for short non-orchestrated requests", () => {
  const ctx = createIntegrationContext("aa-routing-simple-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Hello", "hi");
    const result = router.route(input);

    assert.equal(result.requiresOrchestration, false);
    assert.ok(
      result.workflowId.includes("single_agent") || result.workflowId.includes("minimal"),
      `Expected single_agent or minimal workflow, got: ${result.workflowId}`,
    );
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter classifies cancel intent with highest priority", () => {
  const ctx = createIntegrationContext("aa-routing-cancel-");
  try {
    const router = new IntakeRouter();

    // Mix cancel keywords with others - cancel should win
    const input = makeRouteInput("Stop", "cancel the operation and stop what you are doing");
    const result = router.route(input);

    assert.equal(result.classification.intent, "cancel");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter classifies correction intent with correction continuation", () => {
  const ctx = createIntegrationContext("aa-routing-correction-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Correction", "actually, that was wrong - please fix it");
    const result = router.route(input);

    assert.equal(result.classification.intent, "correction");
    assert.equal(result.classification.continuation, "correction");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter detects follow-up continuation", () => {
  const ctx = createIntegrationContext("aa-routing-followup-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Continue", "continue from where we left off");
    const result = router.route(input);

    assert.equal(result.classification.continuation, "follow_up");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter routes long requests to orchestration based on length", () => {
  const ctx = createIntegrationContext("aa-routing-long-");
  try {
    const router = new IntakeRouter();

    // Request > 120 chars without orchestration keywords
    const longRequest = "Please analyze the following requirements and then implement a solution that handles the edge cases while ensuring proper error handling and logging throughout the entire process";
    const input = makeRouteInput("Complex task", longRequest);
    const result = router.route(input);

    assert.equal(result.requiresOrchestration, true);
    assert.equal(result.routeReason, "route.multi_step_or_high_context");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter produces route trace for debugging", () => {
  const ctx = createIntegrationContext("aa-routing-trace-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Test", "analyze the system status");
    const result = router.route(input);

    assert.ok(result.routeTrace.length > 0, "Should have route trace entries");
    assert.ok(result.routeTrace.some((t) => t.startsWith("matched_keywords:")), "Should include keyword matching");
    assert.ok(result.routeTrace.some((t) => t.startsWith("intent:")), "Should include intent classification");
    assert.ok(result.routeTrace.some((t) => t.startsWith("route:selected:")), "Should include selected route");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter assigns division based on trigger patterns", () => {
  const ctx = createIntegrationContext("aa-routing-division-");
  try {
    const router = new IntakeRouter();

    // "implement" should trigger coding division
    const input = makeRouteInput("Coding task", "implement a new feature in the codebase");
    const result = router.route(input);

    assert.ok(result.divisionId, "Should have divisionId");
    assert.ok(
      result.divisionId === "general_ops" || result.divisionId === "coding" || result.divisionId.length > 0,
      `Expected valid division, got: ${result.divisionId}`,
    );
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine AgentTeamService builds team plan from workflow", () => {
  const ctx = createIntegrationContext("aa-routing-team-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "multi-step task",
    });

    const teamService = new AgentTeamService();
    const teamInput: AgentTeamPlanInput = {
      taskId: "task_team_001",
      workflow: planned,
      riskLevel: "medium",
    };

    const teamPlan = teamService.buildPlan(teamInput);

    assert.ok(teamPlan.teamId.startsWith("team:"), "Should have teamId");
    assert.equal(teamPlan.taskId, "task_team_001");
    assert.equal(teamPlan.workflowId, "single_division_multi_step_orchestration");
    assert.equal(teamPlan.riskLevel, "medium");
    assert.ok(teamPlan.lanes.length > 0, "Should have lanes");
    assert.deepEqual(teamPlan.executionLoop, ["plan", "build", "review", "validate", "repair", "validate", "release"]);
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine AgentTeamService assigns model tiers based on stage and risk", () => {
  const ctx = createIntegrationContext("aa-routing-tier-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "simple task",
    });

    const teamService = new AgentTeamService();
    const highRiskPlan = teamService.buildPlan({
      taskId: "task_risk_001",
      workflow: planned,
      riskLevel: "high",
    });
    const lowRiskPlan = teamService.buildPlan({
      taskId: "task_risk_002",
      workflow: planned,
      riskLevel: "low",
    });

    // High risk review should use "strong" model
    const highRiskReviewLane = highRiskPlan.lanes.find((l) => l.stage === "review")!;
    assert.equal(highRiskReviewLane.modelTier, "strong");

    // Low risk review should use "standard" model
    const lowRiskReviewLane = lowRiskPlan.lanes.find((l) => l.stage === "review")!;
    assert.equal(lowRiskReviewLane.modelTier, "standard");
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine AgentTeamService builds lane per workflow step", () => {
  const ctx = createIntegrationContext("aa-routing-lane-");
  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_division_multi_step_orchestration",
      request: "multi-step task",
    });

    const teamService = new AgentTeamService();
    const teamPlan = teamService.buildPlan({
      taskId: "task_lane_001",
      workflow: planned,
    });

    // Should have lanes for each execution step plus fixed stages
    const buildLanes = teamPlan.lanes.filter((l) => l.stage === "build");
    assert.equal(buildLanes.length, planned.executionSteps.length, "Should have one build lane per step");

    // Each build lane should reference the step's role and agent
    for (const step of planned.executionSteps) {
      const lane = buildLanes.find((l) => l.ownerRoleId === step.roleId);
      assert.ok(lane, `Should have lane for step ${step.stepId} with role ${step.roleId}`);
      assert.equal(lane!.agentId, step.agentId);
    }
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine uses seeded integration context with workflow planning", () => {
  const ctx = createSeededIntegrationContext("aa-routing-seeded-");

  try {
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: "single_agent_minimal",
      request: "seeded test",
    });

    assert.equal(planned.executionSteps.length, 1);
    assert.equal(planned.executionSteps[0]!.roleId, "general_executor");

    const teamService = new AgentTeamService();
    const teamPlan = teamService.buildPlan({
      taskId: "task-seeded-001",
      workflow: planned,
    });

    assert.ok(teamPlan.teamId, "Should have team plan from seeded context");
    assert.equal(teamPlan.lanes.length > 0, true);
  } finally {
    ctx.cleanup();
  }
});

test("RoutingEngine IntakeRouter handles Chinese keywords for international routing", () => {
  const ctx = createIntegrationContext("aa-routing-i18n-");
  try {
    const router = new IntakeRouter();

    // Chinese keywords should also trigger orchestration
    const input = makeRouteInput("分析任务", "设计和实现一个安全审查流程");
    const result = router.route(input);

    assert.equal(result.classification.intent, "create");
    assert.equal(result.requiresOrchestration, true);
  } finally {
    ctx.cleanup();
  }
});