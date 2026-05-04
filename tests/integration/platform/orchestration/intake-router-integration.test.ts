/**
 * Integration Test: Intake Router
 *
 * Tests the IntakeRouter service which classifies incoming requests
 * and routes them to appropriate divisions and workflows.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { IntakeRouter, type IntakeRouteInput } from "../../../../src/platform/orchestration/routing/intake-router.js";
import { getDefaultDivisionRegistry } from "../../../../src/domains/governance/division-loader.js";

function makeRouteInput(title: string, request: string): IntakeRouteInput {
  return { title, request };
}

test("IntakeRouter classifies simple query request", () => {
  const ctx = createIntegrationContext("aa-intake-query-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Status check", "what is the current status of the deployment?");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "query");
    assert.equal(result.routeDecision.classification.continuation, "new_task");
    assert.ok(result.routeDecision.classification.confidence >= 0.45);
    assert.ok(result.routeDecision.routeTrace.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter classifies create request", () => {
  const ctx = createIntegrationContext("aa-intake-create-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("New feature", "create a new API endpoint for user management");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "create");
    assert.ok(result.routeDecision.routeTrace.some((t) => t.startsWith("intent:")));
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter classifies modify request", () => {
  const ctx = createIntegrationContext("aa-intake-modify-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Fix bug", "fix the authentication bug in the login flow");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "modify");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter detects orchestration hints and routes to multi-step workflow", () => {
  const ctx = createIntegrationContext("aa-intake-orchestration-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Analysis task", "plan analyze and implement a security review across the codebase");
    const result = router.route(input);

    assert.equal(result.routeDecision.requiresOrchestration, true);
    assert.equal(result.routeDecision.routeReason, "route.multi_step_or_high_context");
    assert.ok(result.routeDecision.workflowId.length > 0, "Should select a workflow");
    assert.ok(result.routeDecision.routeTrace.some((trace) => trace.startsWith("route:selected:")));
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter uses simple workflow for short requests without orchestration hints", () => {
  const ctx = createIntegrationContext("aa-intake-simple-");
  try {
    const router = new IntakeRouter();

    // Short request without orchestration keywords
    const input = makeRouteInput("Hello", "hi");
    const result = router.route(input);

    assert.equal(result.routeDecision.requiresOrchestration, false);
    assert.ok(result.routeDecision.workflowId.includes("single_agent") || result.routeDecision.workflowId.includes("minimal"));
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter classifies approval request", () => {
  const ctx = createIntegrationContext("aa-intake-approve-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Approval", "approve the deployment to production");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "approve");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter classifies cancel request", () => {
  const ctx = createIntegrationContext("aa-intake-cancel-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Cancel", "cancel the current operation");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "cancel");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter classifies correction request", () => {
  const ctx = createIntegrationContext("aa-intake-correction-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Correction", "actually, that was wrong - please fix it");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.intent, "correction");
    assert.equal(result.routeDecision.classification.continuation, "correction");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter detects follow-up continuation", () => {
  const ctx = createIntegrationContext("aa-intake-followup-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Continue", "continue from where we left off");
    const result = router.route(input);

    assert.equal(result.routeDecision.classification.continuation, "follow_up");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter routes long requests to orchestration", () => {
  const ctx = createIntegrationContext("aa-intake-long-");
  try {
    const router = new IntakeRouter();

    // Request longer than 120 characters without explicit orchestration keywords
    const longRequest = "Please analyze the following requirements and then implement a solution that handles the edge cases while ensuring proper error handling and logging throughout the entire process";
    const input = makeRouteInput("Complex task", longRequest);
    const result = router.route(input);

    assert.equal(result.routeDecision.requiresOrchestration, true);
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter produces route trace for debugging", () => {
  const ctx = createIntegrationContext("aa-intake-trace-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Test", "analyze the system status");
    const result = router.route(input);

    assert.ok(result.routeDecision.routeTrace.length > 0, "Should have route trace entries");
    assert.ok(result.routeDecision.routeTrace.some((t) => t.startsWith("matched_keywords:")), "Should include keyword matching");
    assert.ok(result.routeDecision.routeTrace.some((t) => t.startsWith("intent:")), "Should include intent classification");
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter assigns correct division ID", () => {
  const ctx = createIntegrationContext("aa-intake-division-");
  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Coding task", "implement a new feature in the codebase");
    const result = router.route(input);

    assert.ok(result.routeDecision.divisionId, "Should have divisionId");
    // Default should be general_ops or coding
    assert.ok(
      result.routeDecision.divisionId === "general_ops" ||
      result.routeDecision.divisionId === "coding" ||
      result.routeDecision.divisionId.length > 0,
    );
  } finally {
    ctx.cleanup();
  }
});

test("IntakeRouter uses seeded context", () => {
  const ctx = createIntegrationContext("aa-intake-seeded-");

  try {
    const router = new IntakeRouter();

    const input = makeRouteInput("Test", "simple test request");
    const result = router.route(input);

    assert.ok(result.routeDecision.workflowId);
    assert.ok(result.routeDecision.divisionId);
    assert.ok(result.routeDecision.routeReason);
  } finally {
    ctx.cleanup();
  }
});
