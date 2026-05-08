/**
 * E2E Routing Service Tests
 *
 * End-to-end tests covering workflow routing service:
 * 1. Intake routing based on classification
 * 2. Workflow assignment
 * 3. Agent-team routing
 * 4. Routing strategy selection
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore
import { createE2EHarness } from "../helpers/e2e-harness.js";
// @ts-ignore
import { IntakeRouter } from "../../src/platform/orchestration/routing/intake-router.js";
// @ts-ignore
import { WorkflowPlanner } from "../../src/platform/orchestration/routing/workflow-planner.js";
// @ts-ignore
import { AgentTeamService } from "../../src/platform/orchestration/routing/agent-team-service.js";
// @ts-ignore
import type { IntakeClassification, RoutingDecision, WorkflowAssignment } from "../../src/platform/orchestration/routing/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createIntakeClassification(overrides: Partial<IntakeClassification> = {}): IntakeClassification {
  return {
    intent: overrides.intakeClassification ?? "create",
    continuation: overrides.continuation ?? "new_task",
    confidence: overrides.confidence ?? 0.95,
    divisionId: overrides.divisionId ?? "devops",
    workflowId: overrides.workflowId ?? "single_agent_minimal",
    matchedRules: overrides.matchedRules ?? ["default"],
    ambiguityFlags: overrides.ambiguityFlags ?? [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Intake Routing
// ---------------------------------------------------------------------------

test("E2E Routing: IntakeRouter classifies incoming request and assigns workflow", async () => {
  const harness = createE2EHarness("aa-e2e-routing-");
  try {
    const router = new IntakeRouter();

    const classification = createIntakeClassification({
      intent: "create",
      continuation: "new_task",
    });

    const decision = router.route(classification);

    assert.ok(decision, "Should return routing decision");
    assert.ok(decision.workflowId, "Should have workflow ID");
    assert.equal(decision.targetDivision, "devops", "Should target correct division");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Workflow Planning
// ---------------------------------------------------------------------------

test("E2E Routing: WorkflowPlanner generates execution plan for workflow", async () => {
  const harness = createE2EHarness("aa-e2e-routing-plan-");
  try {
    const planner = new WorkflowPlanner();

    const assignment: WorkflowAssignment = {
      workflowId: "single_agent_minimal",
      taskId: "task_e2e_001",
      divisionId: "devops",
    };

    const plan = planner.generatePlan(assignment);

    assert.ok(plan, "Should return execution plan");
    assert.ok(Array.isArray(plan.steps), "Should have steps");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Agent Team Service
// ---------------------------------------------------------------------------

test("E2E Routing: AgentTeamService assigns agents to workflow tasks", async () => {
  const harness = createE2EHarness("aa-e2e-routing-team-");
  try {
    const service = new AgentTeamService();

    const assignment: WorkflowAssignment = {
      workflowId: "multi_agent_collaboration",
      taskId: "task_e2e_001",
      divisionId: "devops",
    };

    const teamAssignment = service.assignTeam(assignment);

    assert.ok(teamAssignment, "Should return team assignment");
    assert.ok(Array.isArray(teamAssignment.agents), "Should have agents array");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Routing Strategy Selection
// ---------------------------------------------------------------------------

test("E2E Routing: Service selects appropriate routing strategy based on task characteristics", async () => {
  const harness = createE2EHarness("aa-e2e-routing-strategy-");
  try {
    const router = new IntakeRouter();

    const highPriorityClassification = createIntakeClassification({
      intent: "create",
      confidence: 0.95,
    });

    const decision = router.route(highPriorityClassification);

    assert.ok(decision.strategy, "Should have routing strategy");
  } finally {
    harness.cleanup();
  }
});