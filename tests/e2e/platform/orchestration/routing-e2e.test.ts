import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../../../src/platform/five-plane-orchestration/routing/intake-router.js";
import { WorkflowPlanner } from "../../../../src/platform/five-plane-orchestration/routing/workflow-planner.js";
import { AgentTeamService } from "../../../../src/platform/five-plane-orchestration/routing/agent-team-service.js";

test("E2E Routing: simple request stays on the minimal workflow", () => {
  const router = new IntakeRouter();

  const decision = router.route({
    title: "Read a file",
    request: "Open README.md and summarize the first section.",
  });

  assert.equal(decision.requiresOrchestration, false);
  assert.equal(typeof decision.workflowId, "string");
  assert.equal(typeof decision.divisionId, "string");
});

test("E2E Routing: orchestration-heavy request is routed to a multi-step workflow", () => {
  const router = new IntakeRouter();

  const decision = router.route({
    title: "Plan and execute",
    request: "Analyze the task, break it down, orchestrate multiple steps, validate the result, and explain the tradeoffs.",
  });

  assert.equal(decision.requiresOrchestration, true);
  assert.ok(decision.routeReason.length > 0);
  assert.ok(decision.routeTrace.length > 0);
});

test("E2E Routing: workflow planner materializes execution steps and dependency edges", () => {
  const planner = new WorkflowPlanner();

  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Run a multi-step coding workflow.",
  });

  assert.ok(planned.executionSteps.length > 1);
  assert.ok(planned.dependencyEdges.length > 0);
  assert.equal(planned.workflow.workflowId, "single_division_multi_step_orchestration");
});

test("E2E Routing: agent team plan derives lanes from the planned workflow", () => {
  const planner = new WorkflowPlanner();
  const teamService = new AgentTeamService();
  const workflow = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Prepare a coordinated multi-step workflow.",
  });

  const teamPlan = teamService.buildPlan({
    taskId: "task-routing-team",
    workflow,
    riskLevel: "medium",
  });

  assert.ok(teamPlan.lanes.length >= workflow.executionSteps.length);
  assert.ok(teamPlan.executionLoop.includes("plan"));
  assert.ok(teamPlan.executionLoop.includes("release"));
});
