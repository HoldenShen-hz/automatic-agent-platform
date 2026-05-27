/**
 * Unit Tests: Task Intake Router
 *
 * Tests for the intake router module which handles request classification
 * and workflow selection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../../src/platform/five-plane-orchestration/routing/intake-router.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

import type { IntakeRouteInput } from "../../../src/platform/five-plane-orchestration/routing/intake-router.js";

function createRouteInput(overrides: Partial<IntakeRouteInput> = {}): IntakeRouteInput {
  return {
    request: "test request",
    title: "Test Task",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// IntakeRouter Basic Tests
// ---------------------------------------------------------------------------

test("IntakeRouter can be instantiated without options [task-intake]", () => {
  const router = new IntakeRouter();
  assert.ok(router instanceof IntakeRouter);
});

test("IntakeRouter can be instantiated with null divisionRegistry [task-intake]", () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  assert.ok(router instanceof IntakeRouter);
});

// ---------------------------------------------------------------------------
// Simple Query Routing Tests
// ---------------------------------------------------------------------------

test("route() routes simple query to single_agent_minimal workflow [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "what is the status of my tasks?",
  });

  const decision = await router.route(input);

  assert.equal(decision.workflowId, "single_agent_minimal");
  assert.equal(decision.divisionId, "general_ops");
  assert.ok(decision.routeTrace.length > 0);
  assert.ok(!decision.requiresOrchestration);
});

test("route() routes simple question to single_agent_minimal workflow [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "how do I create a new project?",
  });

  const decision = await router.route(input);

  assert.equal(decision.workflowId, "single_agent_minimal");
  assert.equal(decision.requiresOrchestration, false);
});

// ---------------------------------------------------------------------------
// Orchestration Hint Routing Tests
// ---------------------------------------------------------------------------

test("route() requires orchestration when request contains multiple orchestration hints [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "plan and analyze the research data for the project",
  });

  const decision = await router.route(input);

  assert.equal(decision.requiresOrchestration, true);
  assert.ok(decision.workflowId.includes("orchestration") || decision.workflowId.includes("multi_step"));
});

test("route() requires orchestration for requests with 120+ characters [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const longRequest = "Please analyze the current market trends, compare them with historical data, and summarize the findings along with recommendations for strategic planning purposes based on comprehensive research";
  const input = createRouteInput({
    request: longRequest,
  });

  const decision = await router.route(input);

  assert.ok(decision.requiresOrchestration);
});

test("route() does not require orchestration for short requests without hints [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "hello",
  });

  const decision = await router.route(input);

  assert.ok(!decision.requiresOrchestration);
  assert.equal(decision.workflowId, "single_agent_minimal");
});

// ---------------------------------------------------------------------------
// Intent Classification Tests
// ---------------------------------------------------------------------------

test("route() classifies query intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "what is the weather like today?",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "query");
  assert.ok(decision.classification.confidence >= 0.45);
});

test("route() classifies create intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "create a new document for the project proposal",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "create");
});

test("route() classifies modify intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "update the status of the task to completed",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "modify");
});

test("route() classifies cancel intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "cancel the current operation",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "cancel");
});

test("route() classifies approve intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "approve the changes and merge the pull request",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "approve");
});

test("route() classifies clarify intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "can you clarify what you meant by that?",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "clarify");
});

test("route() classifies correction intent correctly [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "actually, I meant to update the other file instead",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "correction");
  assert.equal(decision.classification.continuation, "correction");
});

// ---------------------------------------------------------------------------
// Continuation Classification Tests
// ---------------------------------------------------------------------------

test("route() detects follow_up continuation [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "continue with the next step of the analysis",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.continuation, "follow_up");
});

test("route() detects new_task continuation for simple requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "list all available projects",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.continuation, "new_task");
});

// ---------------------------------------------------------------------------
// Risk-Based Routing Tests
// ---------------------------------------------------------------------------

test("route() requires orchestration for high risk requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "deploy to production",
    riskPreview: {
      riskClass: "high",
      reasons: ["production deployment"],
    },
  });

  const decision = await router.route(input);

  assert.ok(decision.requiresOrchestration);
  assert.ok(decision.routeTrace.some((t) => t.includes("risk_class")));
});

test("route() requires orchestration for critical risk requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "delete all records",
    riskPreview: {
      riskClass: "critical",
      reasons: ["destructive operation"],
    },
  });

  const decision = await router.route(input);

  assert.ok(decision.requiresOrchestration);
});

// ---------------------------------------------------------------------------
// Chinese Language Support Tests
// ---------------------------------------------------------------------------

test("route() handles Chinese query requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "查看当前项目的状态",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "query");
});

test("route() handles Chinese create requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "创建一个新的文档",
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "create");
});

test("route() routes Chinese high-complexity requests to orchestration [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "分析市场趋势并设计营销方案",
  });

  const decision = await router.route(input);

  assert.ok(decision.requiresOrchestration);
});

// ---------------------------------------------------------------------------
// Route Trace Tests
// ---------------------------------------------------------------------------

test("route() includes trace information in decision [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "what is the status?",
    tenantId: "test-tenant",
    traceId: "trace-123",
  });

  const decision = await router.route(input);

  assert.ok(decision.routeTrace.length > 0);
  assert.ok(decision.routeTrace.some((t) => t.includes("intent:")));
  assert.ok(decision.routeTrace.some((t) => t.includes("tenantId:")));
});

test("route() includes confirmedTaskSpecId in trace [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "test request",
    confirmedTaskSpecId: "spec-456",
  });

  const decision = await router.route(input);

  assert.equal(decision.confirmedTaskSpecId, "spec-456");
  assert.ok(decision.routeTrace.some((t) => t.includes("confirmedTaskSpecId:")));
});

// ---------------------------------------------------------------------------
// Preferred Intent Tests
// ---------------------------------------------------------------------------

test("route() uses preferred intent when confidence is high enough [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "some ambiguous text",
    preferredIntent: {
      intent: "create",
      confidence: 0.85,
      reasoning: "user explicitly requested creation",
    },
  });

  const decision = await router.route(input);

  assert.equal(decision.classification.intent, "create");
  assert.ok(decision.routeTrace.some((t) => t.includes("preferred_intent:")));
});

test("route() ignores preferred intent when confidence is below threshold [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "show me the status",
    preferredIntent: {
      intent: "modify",
      confidence: 0.5, // Below 0.80 threshold
      reasoning: "not confident",
    },
  });

  const decision = await router.route(input);

  // Should still classify as query based on keyword matching
  assert.equal(decision.classification.intent, "query");
});

// ---------------------------------------------------------------------------
// Title and Request Combination Tests
// ---------------------------------------------------------------------------

test("route() combines title and request for analysis [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    title: "Build new feature",
    request: "implement the changes in the codebase",
  });

  const decision = await router.route(input);

  // Both title and request should influence classification
  assert.ok(decision.classification.intent === "create" || decision.classification.intent === "modify");
});

test("route() handles empty title gracefully [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    title: "",
    request: "what is the status?",
  });

  const decision = await router.route(input);

  assert.ok(decision.workflowId === "single_agent_minimal");
});

// ---------------------------------------------------------------------------
// Edge Case Tests
// ---------------------------------------------------------------------------

test("route() handles very short requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "hi",
  });

  const decision = await router.route(input);

  assert.ok(decision.workflowId === "single_agent_minimal");
  assert.ok(!decision.requiresOrchestration);
});

test("route() handles requests with only special characters [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "???",
  });

  const decision = await router.route(input);

  assert.ok(decision.routeTrace.length > 0);
});

test("route() handles extremely long requests with orchestration hints [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const repeatedPhrase = "please analyze and review the data ";
  const longRequest = repeatedPhrase.repeat(10);
  const input = createRouteInput({
    request: longRequest,
  });

  const decision = await router.route(input);

  assert.ok(decision.requiresOrchestration);
});

test("route() sets agentId for simple requests [task-intake]", async () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const input = createRouteInput({
    request: "show me the status",
  });

  const decision = await router.route(input);

  assert.ok(decision.agentId != null);
  assert.ok(decision.agentId.includes("agent"));
});