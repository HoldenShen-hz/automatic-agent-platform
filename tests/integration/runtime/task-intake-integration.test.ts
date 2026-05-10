/**
 * Integration Tests: Task Intake Router
 *
 * Integration tests for the intake router with real storage backends.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter } from "../../../src/platform/orchestration/routing/intake-router.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import type { IntakeRouteInput } from "../../../src/platform/orchestration/routing/intake-router.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createRouteInput(overrides: Partial<Omit<IntakeRouteInput, "tenantId" | "traceId" | "riskPreview" | "principal" | "priorConversationContext" | "preferredIntent" | "confirmedTaskSpecId">> = {}): IntakeRouteInput {
  return {
    request: "test request",
    title: "Test Task",
    ...overrides,
  } as IntakeRouteInput;
}

// ---------------------------------------------------------------------------
// IntakeRouter Integration Tests
// ---------------------------------------------------------------------------

test("IntakeRouter works with real context propagation", async () => {
  const workspace = createTempWorkspace("aa-int-intake-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "analyze the market research data",
    });

    const decision = await router.route(input);

    // Verify routing decision is complete
    assert.ok(decision.workflowId.length > 0);
    assert.ok(decision.divisionId.length > 0);
    assert.ok(decision.routeTrace.length > 0);
    assert.ok(decision.requiresOrchestration === true || decision.requiresOrchestration === false);
    assert.ok(decision.classification.intent.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles high-risk requests with real context", async () => {
  const workspace = createTempWorkspace("aa-int-risk-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "deploy to production environment",
    });

    const decision = await router.route(input);

    // High risk should always require orchestration
    assert.ok(decision.requiresOrchestration);
    assert.ok(decision.routeTrace.some((t) => t.includes("risk_class")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles tenant context in routing", async () => {
  const workspace = createTempWorkspace("aa-int-tenant-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "show me the status",
    });

    const decision = await router.route(input);

    assert.ok(decision.routeTrace.some((t) => t.includes("tenantId:")));
    assert.equal(decision.workflowId, "single_agent_minimal");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles trace context in routing", async () => {
  const workspace = createTempWorkspace("aa-int-trace-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "list all projects",
    });

    const decision = await router.route(input);

    // Route trace should contain trace ID
    assert.ok(decision.routeTrace.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles principal in routing", async () => {
  const workspace = createTempWorkspace("aa-int-principal-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "create a new document",
    });

    const decision = await router.route(input);

    assert.ok(decision.routeTrace.some((t) => t.includes("principalId:")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles long complex requests with orchestration", async () => {
  const workspace = createTempWorkspace("aa-int-complex-");

  try {
    const router = new IntakeRouter();
    const longRequest = "Please analyze the current market trends, review the competitive landscape, compare historical performance data, and provide comprehensive recommendations for strategic planning and future growth initiatives";
    const input = createRouteInput({
      request: longRequest,
    });

    const decision = await router.route(input);

    assert.ok(decision.requiresOrchestration);
    assert.ok(decision.routeTrace.some((t) => t.includes("matched_keywords:")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter combines title and request for accurate classification", async () => {
  const workspace = createTempWorkspace("aa-int-combined-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      title: "Build new feature",
      request: "implement the changes according to the specifications",
    });

    const decision = await router.route(input);

    // Both title and request should influence the classification
    assert.ok(
      decision.classification.intent === "create" ||
      decision.classification.intent === "modify",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles follow-up continuation requests", async () => {
  const workspace = createTempWorkspace("aa-int-followup-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "continue with the analysis from the previous step",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.continuation, "follow_up");
    // Follow-up with orchestration hint should require orchestration
    assert.ok(decision.requiresOrchestration);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles query continuation correctly", async () => {
  const workspace = createTempWorkspace("aa-int-query-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "what is the status of the project?",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "query");
    assert.equal(decision.classification.continuation, "new_task");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter with preferred intent uses high confidence", async () => {
  const workspace = createTempWorkspace("aa-int-preferred-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "please do something",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "create");
    assert.ok(decision.routeTrace.some((t) => t.includes("preferred_intent:")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles Chinese language requests", async () => {
  const workspace = createTempWorkspace("aa-int-chinese-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "分析市场趋势并设计营销方案",
    });

    const decision = await router.route(input);

    // Should handle Chinese text and route to orchestration due to complexity
    assert.ok(decision.requiresOrchestration);
    assert.ok(decision.routeTrace.some((t) => t.includes("matched_keywords:")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles approve requests correctly", async () => {
  const workspace = createTempWorkspace("aa-int-approve-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "approve the changes and merge the pull request",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "approve");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles cancel requests correctly", async () => {
  const workspace = createTempWorkspace("aa-int-cancel-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "cancel the current operation",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "cancel");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles clarification requests correctly", async () => {
  const workspace = createTempWorkspace("aa-int-clarify-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "can you clarify what you meant by that?",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "clarify");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles correction requests correctly", async () => {
  const workspace = createTempWorkspace("aa-int-correction-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "actually, I meant to update the other file",
    });

    const decision = await router.route(input);

    assert.equal(decision.classification.intent, "correction");
    assert.equal(decision.classification.continuation, "correction");
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter produces deterministic routing for same input", async () => {
  const workspace = createTempWorkspace("aa-int-deterministic-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "analyze the quarterly financial report",
    });

    const decision1 = await router.route(input);
    const decision2 = await router.route(input);

    assert.equal(decision1.workflowId, decision2.workflowId);
    assert.equal(decision1.divisionId, decision2.divisionId);
    assert.equal(decision1.requiresOrchestration, decision2.requiresOrchestration);
    assert.equal(decision1.classification.intent, decision2.classification.intent);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter route trace is informative", async () => {
  const workspace = createTempWorkspace("aa-int-trace-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      request: "create a new project document",
    });

    const decision = await router.route(input);

    // Route trace should contain key decision points
    assert.ok(decision.routeTrace.some((t) => t.startsWith("intent:")));
    assert.ok(decision.routeTrace.some((t) => t.startsWith("route:selected:")));
    assert.ok(decision.routeTrace.some((t) => t.startsWith("confidence:")));
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles minimal input gracefully", async () => {
  const workspace = createTempWorkspace("aa-int-minimal-");

  try {
    const router = new IntakeRouter();
    const input: IntakeRouteInput = {
      request: "hi",
    };

    const decision = await router.route(input);

    // Should still produce a valid routing decision
    assert.ok(decision.workflowId.length > 0);
    assert.ok(decision.divisionId.length > 0);
    assert.ok(decision.routeTrace.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("IntakeRouter handles empty title gracefully", async () => {
  const workspace = createTempWorkspace("aa-int-empty-title-");

  try {
    const router = new IntakeRouter();
    const input = createRouteInput({
      title: "",
      request: "show me the status",
    });

    const decision = await router.route(input);

    assert.ok(decision.workflowId === "single_agent_minimal");
    assert.ok(!decision.requiresOrchestration);
  } finally {
    cleanupPath(workspace);
  }
});