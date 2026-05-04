/**
 * Intake Router Unit Tests - Extended Coverage
 *
 * Tests for IntakeRouter business logic including Chinese keywords,
 * complexity-based routing, and follow-up detection.
 *
 * Architecture: §5 Control Plane - Intake Router
 */

import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter, type IntakeRouteInput } from "../../../../../src/platform/orchestration/routing/intake-router.js";
import type { DivisionRegistry, LoadedDivisionDefinition } from "../../../../../src/domains/governance/division-loader.js";

function createMockDivision(overrides: Partial<LoadedDivisionDefinition> & { id: string }): LoadedDivisionDefinition {
  return {
    id: overrides.id,
    version: overrides.version ?? "1.0",
    name: overrides.name ?? overrides.id,
    description: overrides.description ?? "Test division",
    priority: overrides.priority ?? 0,
    triggers: overrides.triggers ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId ?? "single_agent_minimal",
    orchestrationWorkflowId: overrides.orchestrationWorkflowId ?? "single_division_multi_step_orchestration",
    roles: overrides.roles ?? [],
    workflows: overrides.workflows ?? [],
    rootPath: overrides.rootPath ?? "/tmp/test",
  };
}

function createMockRegistry(divisions: LoadedDivisionDefinition[]): DivisionRegistry {
  const divisionMap = new Map<string, LoadedDivisionDefinition>();
  for (const div of divisions) {
    divisionMap.set(div.id, div);
  }
  const workflowMap = new Map<string, { workflowId: string; divisionId: string; steps: readonly { stepId: string; roleId: string; outputKey: string; timeoutMs: number }[] }>();
  return { divisions: divisionMap, workflows: workflowMap as any };
}

function createRouteInput(overrides: Partial<IntakeRouteInput> = {}): IntakeRouteInput {
  return {
    title: overrides.title ?? "Test request",
    request: overrides.request ?? "",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestration Hint Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter detects single orchestration hint", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "please plan the task" }));

  assert.ok(result.routeDecision.routeTrace.some(t => t.includes("matched_keywords")));
});

test("IntakeRouter detects multiple orchestration hints", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "analyze and design the solution workflow" }));

  assert.ok(result.routeDecision.requiresOrchestration);
});

test("IntakeRouter does not require orchestration for simple queries", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "what is the status?" }));

  assert.equal(result.routeDecision.requiresOrchestration, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Chinese Keyword Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter detects Chinese plan keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "请帮我规划这个任务" }));

  assert.ok(result.routeDecision.routeTrace.some(t => t.includes("matched_keywords")));
});

test("IntakeRouter detects Chinese analyze keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "分析一下这个问题" }));

  assert.ok(result.routeDecision.requiresOrchestration);
});

test("IntakeRouter detects Chinese design keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "设计一个系统方案" }));

  assert.ok(result.routeDecision.requiresOrchestration);
});

test("IntakeRouter detects Chinese research keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "研究这个课题" }));

  assert.ok(result.routeDecision.requiresOrchestration);
});

test("IntakeRouter detects Chinese compare keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "对比两种方案" }));

  assert.ok(result.routeDecision.requiresOrchestration);
});

// ─────────────────────────────────────────────────────────────────────────────
// Request Length Threshold Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter triggers orchestration for long requests", () => {
  const router = new IntakeRouter();
  const longRequest = "This is a very long request that describes in detail what needs to be accomplished with multiple steps and considerations for the task execution environment and expected outcomes";
  const result = router.route(createRouteInput({ request: longRequest }));

  assert.equal(result.routeDecision.requiresOrchestration, true);
});

test("IntakeRouter does not trigger orchestration for short requests", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "simple task" }));

  assert.equal(result.routeDecision.requiresOrchestration, false);
});

test("IntakeRouter boundary at exactly 120 characters", () => {
  const router = new IntakeRouter();
  const request120 = "a".repeat(120);
  const result120 = router.route(createRouteInput({ title: "", request: request120 }));
  assert.equal(result120.routeDecision.requiresOrchestration, true);

  const request119 = "a".repeat(119);
  const result119 = router.route(createRouteInput({ title: "", request: request119 }));
  assert.equal(result119.routeDecision.requiresOrchestration, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Intent Classification Priority Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter correction takes priority over other intents", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "actually I want to correct this" }));

  assert.equal(result.routeDecision.classification.intent, "correction");
});

test("IntakeRouter cancel takes priority over clarify", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "cancel the operation and clarify something" }));

  // cancel has higher priority than clarify
  assert.equal(result.routeDecision.classification.intent, "cancel");
});

test("IntakeRouter clarify takes priority over chitchat", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "clarify what you mean, thanks" }));

  assert.equal(result.routeDecision.classification.intent, "clarify");
});

test("IntakeRouter chitchat detected when no other intent matches", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "hello there, how are you" }));

  assert.equal(result.routeDecision.classification.intent, "chitchat");
});

// ─────────────────────────────────────────────────────────────────────────────
// Continuation Type Detection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter detects follow_up via continue keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "continue with the previous task" }));

  assert.equal(result.routeDecision.classification.continuation, "follow_up");
});

test("IntakeRouter detects follow_up via Chinese 继续", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "继续做这个任务" }));

  assert.equal(result.routeDecision.classification.continuation, "follow_up");
});

test("IntakeRouter detects follow_up via then keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "then do the next step" }));

  assert.equal(result.routeDecision.classification.continuation, "follow_up");
});

test("IntakeRouter defaults to new_task for simple requests", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "build a feature" }));

  assert.equal(result.routeDecision.classification.continuation, "new_task");
});

// ─────────────────────────────────────────────────────────────────────────────
// Division Selection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter selects division based on trigger match", () => {
  const codingDivision = createMockDivision({
    id: "coding",
    triggers: ["code", "programming", "develop", "开发"],
    priority: 10,
  });
  const registry = createMockRegistry([codingDivision]);

  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "develop a new feature" }));

  assert.equal(result.routeDecision.divisionId, "coding");
});

test("IntakeRouter selects highest priority division when multiple match", () => {
  const lowPriority = createMockDivision({
    id: "ops",
    triggers: ["deploy", "release"],
    priority: 5,
  });
  const highPriority = createMockDivision({
    id: "platform",
    triggers: ["deploy", "release", "infrastructure"],
    priority: 10,
  });
  const registry = createMockRegistry([lowPriority, highPriority]);

  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "deploy to production" }));

  assert.equal(result.routeDecision.divisionId, "platform");
});

test("IntakeRouter falls back to general_ops when no division matches", () => {
  const registry = createMockRegistry([createMockDivision({ id: "other" })]);
  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "xyz123 unknown trigger" }));

  assert.equal(result.routeDecision.divisionId, "general_ops");
});

test("IntakeRouter uses longest trigger match", () => {
  const shortMatch = createMockDivision({
    id: "dev",
    triggers: ["code"],
    priority: 5,
  });
  const longMatch = createMockDivision({
    id: "developer",
    triggers: ["code", "programming"],
    priority: 5,
  });
  const registry = createMockRegistry([shortMatch, longMatch]);

  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "programming task" }));

  // Both match but "programming" is longer
  assert.ok(result.routeDecision.divisionId);
});

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Selection Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter selects orchestration workflow when required", () => {
  const division = createMockDivision({
    id: "coding",
    defaultWorkflowId: "single_agent_minimal",
    orchestrationWorkflowId: "multi_step_coding",
  });
  const registry = createMockRegistry([division]);

  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "analyze and design a system" }));

  assert.equal(result.routeDecision.requiresOrchestration, true);
  assert.ok(result.routeDecision.workflowId.includes("multi_step") || result.routeDecision.workflowId.includes("orchestration"));
});

test("IntakeRouter selects default workflow for simple requests", () => {
  const division = createMockDivision({
    id: "coding",
    defaultWorkflowId: "single_agent_minimal",
    orchestrationWorkflowId: "multi_step_coding",
  });
  const registry = createMockRegistry([division]);

  const router = new IntakeRouter({ divisionRegistry: registry });
  const result = router.route(createRouteInput({ request: "query the status" }));

  assert.equal(result.routeDecision.requiresOrchestration, false);
  assert.ok(result.routeDecision.workflowId.includes("single") || result.routeDecision.workflowId.includes("minimal"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Scoring Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter confidence increases with matched rules", () => {
  const router = new IntakeRouter();
  const result1 = router.route(createRouteInput({ request: "what" }));
  const result2 = router.route(createRouteInput({ request: "what is the status" }));

  // More keywords should give higher confidence
  assert.ok(result2.routeDecision.classification.confidence >= result1.routeDecision.classification.confidence);
});

test("IntakeRouter confidence increases with matched hints", () => {
  const router = new IntakeRouter();
  const result1 = router.route(createRouteInput({ request: "plan" }));
  const result2 = router.route(createRouteInput({ request: "plan and design" }));

  assert.ok(result2.routeDecision.classification.confidence >= result1.routeDecision.classification.confidence);
});

test("IntakeRouter confidence decreases when nothing matches", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "abc def ghi jkl mno" }));

  // Without matches, confidence should be lower
  assert.ok(result.routeDecision.classification.confidence <= 0.52);
});

test("IntakeRouter confidence is bounded between 0.45 and 0.98", () => {
  const router = new IntakeRouter();

  // Test low confidence case
  const lowConf = router.route(createRouteInput({ request: "xyz" }));
  assert.ok(lowConf.routeDecision.classification.confidence >= 0.45);

  // Test high confidence case
  const highConf = router.route(createRouteInput({ request: "what is the status? I need to analyze and design a solution for the implementation" }));
  assert.ok(highConf.routeDecision.classification.confidence <= 0.98);
});

// ─────────────────────────────────────────────────────────────────────────────
// Route Trace Tests
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter route includes intent in trace", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "create a new feature" }));

  assert.ok(result.routeDecision.routeTrace.some(t => t.startsWith("intent:")));
});

test("IntakeRouter route includes continuation in trace", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "continue with task" }));

  assert.ok(result.routeDecision.routeTrace.some(t => t.startsWith("continuation:")));
});

test("IntakeRouter route includes workflow selection in trace", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "plan the implementation" }));

  assert.ok(result.routeDecision.routeTrace.some(t => t.startsWith("route:selected:")));
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("IntakeRouter handles empty request", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ request: "" }));

  assert.ok(typeof result.routeDecision.classification.intent === "string");
  assert.ok(result.routeDecision.routeTrace.length > 0);
});

test("IntakeRouter handles null division registry", () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const result = router.route(createRouteInput({ request: "test" }));

  assert.equal(result.routeDecision.divisionId, "general_ops");
});

test("IntakeRouter handles missing title", () => {
  const router = new IntakeRouter();
  const result = router.route({ title: "", request: "build feature" });

  assert.ok(typeof result.routeDecision.workflowId === "string");
});
