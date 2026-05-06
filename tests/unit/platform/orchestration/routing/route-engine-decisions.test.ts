import test from "node:test";
import assert from "node:assert/strict";

import {
  IntakeRouter,
  type IntakeRouteInput,
  type IntakeIntent,
  type IntakeContinuation,
} from "../../../../../src/platform/orchestration/routing/intake-router.js";
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
    tenantId: overrides.tenantId,
    traceId: overrides.traceId,
    confirmedTaskSpecId: overrides.confirmedTaskSpecId,
    riskPreview: overrides.riskPreview,
    preferredIntent: overrides.preferredIntent,
    priorConversationContext: overrides.priorConversationContext,
  };
}

// --- IntakeIntent Classification ---

test("IntakeRouter.route classifies query intent for what questions", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Query", request: "what is the current status?" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route classifies query intent for how questions", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Query", request: "how do I deploy?" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route classifies create intent for build keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Create", request: "build a new feature" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route classifies create intent for implement keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Create", request: "implement this feature" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route classifies modify intent for fix keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Fix", request: "fix the bug" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route classifies modify intent for refactor keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Refactor", request: "refactor this module" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route classifies approve intent from ship it phrase", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Approve", request: "ship it" }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route classifies cancel intent for abort keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Cancel", request: "abort the operation" }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route classifies clarify intent for clarification keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Clarify", request: "please clarify what you mean" }));

  assert.equal(result.classification.intent, "clarify");
});

test("IntakeRouter.route classifies correction intent for actually keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Fix", request: "actually that is wrong" }));

  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route classifies chitchat intent for hello keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Hello", request: "hello there" }));

  assert.equal(result.classification.intent, "chitchat");
});

test("IntakeRouter.route prioritizes correction over other intents", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Fix", request: "actually I want you to fix that and also create something new" }));

  assert.equal(result.classification.intent, "correction");
});

// --- Continuation Type ---

test("IntakeRouter.route detects follow_up continuation for continue keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Continue", request: "continue from where we left off" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route detects follow_up continuation for next keyword", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Next", request: "next, do the same" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route detects correction continuation", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Fix", request: "actually that is wrong" }));

  assert.equal(result.classification.continuation, "correction");
});

test("IntakeRouter.route defaults to new_task continuation", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Task", request: "do something" }));

  assert.equal(result.classification.continuation, "new_task");
});

// --- Orchestration Routing ---

test("IntakeRouter.route requires orchestration when 2+ orchestration hints present", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Plan",
    request: "we need to plan and analyze the architecture for this project",
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route requires orchestration for long requests (>120 chars)", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "a".repeat(150),
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route does not require orchestration for short requests", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do this",
  }));

  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route requires orchestration for high risk class from riskPreview", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    riskPreview: { riskClass: "high", reasons: ["test"] },
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.ok(result.routeTrace.includes("riskClass:high"));
});

test("IntakeRouter.route requires orchestration for critical risk class", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    riskPreview: { riskClass: "critical", reasons: ["test"] },
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route does not require orchestration for low risk class on simple request", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do this",
    riskPreview: { riskClass: "low", reasons: ["test"] },
  }));

  assert.equal(result.requiresOrchestration, false);
});

// --- Division Selection ---

test("IntakeRouter.route selects division based on trigger pattern", async () => {
  const codingDivision = createMockDivision({
    id: "coding",
    priority: 10,
    triggers: ["code", "programming", "implement"],
  });
  const registry = createMockRegistry([codingDivision]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Code", request: "implement a feature" }));

  assert.equal(result.divisionId, "coding");
});

test("IntakeRouter.route selects higher priority division when multiple match", async () => {
  const lowPriority = createMockDivision({
    id: "low",
    priority: 1,
    triggers: ["task"],
  });
  const highPriority = createMockDivision({
    id: "high",
    priority: 100,
    triggers: ["task"],
  });
  const registry = createMockRegistry([lowPriority, highPriority]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Task", request: "do some task" }));

  assert.equal(result.divisionId, "high");
});

test("IntakeRouter.route selects longest matching trigger", async () => {
  const shortMatch = createMockDivision({
    id: "short",
    priority: 5,
    triggers: ["code"],
  });
  const longMatch = createMockDivision({
    id: "long",
    priority: 5,
    triggers: ["code quality", "code review"],
  });
  const registry = createMockRegistry([shortMatch, longMatch]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Code", request: "improve code quality" }));

  assert.equal(result.divisionId, "long");
});

test("IntakeRouter.route handles pipe-separated trigger alternatives", async () => {
  const division = createMockDivision({
    id: "devops",
    priority: 10,
    triggers: ["deploy|release|ship"],
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Deploy", request: "deploy to production" }));

  assert.equal(result.divisionId, "devops");
});

test("IntakeRouter.route falls back to general_ops when no division matches", async () => {
  const generalOps = createMockDivision({ id: "general_ops", priority: 0, triggers: [] });
  const registry = createMockRegistry([generalOps]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Unknown", request: "xyz123 abc456" }));

  assert.equal(result.divisionId, "general_ops");
});

// --- Workflow Selection ---

test("IntakeRouter.route uses default workflow for simple requests", async () => {
  const division = createMockDivision({
    id: "test",
    priority: 10,
    triggers: ["test"],
    defaultWorkflowId: "my_default_wf",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({ title: "Test", request: "simple test" }));

  assert.equal(result.workflowId, "my_default_wf");
  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route uses orchestration workflow when orchestration required", async () => {
  const division = createMockDivision({
    id: "test",
    priority: 10,
    triggers: ["test"],
    defaultWorkflowId: "simple_wf",
    orchestrationWorkflowId: "orchestration_wf",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({
    title: "Test",
    request: "plan and analyze this task which requires multiple steps to complete",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "orchestration_wf");
});

test("IntakeRouter.route uses division's orchestrationWorkflowId when available", async () => {
  const division = createMockDivision({
    id: "coding",
    priority: 10,
    triggers: ["code"],
    defaultWorkflowId: "simple_wf",
    orchestrationWorkflowId: "coding_orchestration_wf",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = await router.route(createRouteInput({
    title: "Code",
    request: "implement and test this feature which will require multiple steps",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "coding_orchestration_wf");
});

// --- Confidence Scoring ---

test("IntakeRouter.route computes confidence within valid range 0.45-0.98", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Query", request: "what is status?" }));

  assert.ok(result.classification.confidence >= 0.45);
  assert.ok(result.classification.confidence <= 0.98);
});

test("IntakeRouter.route confidence increases with more matched rules", async () => {
  const router = new IntakeRouter();
  const result1 = await router.route(createRouteInput({ title: "Query", request: "what?" }));
  const result2 = await router.route(createRouteInput({ title: "Query", request: "what is how when where who which show list status query search find explain lookup check" }));

  assert.ok(result2.classification.confidence >= result1.classification.confidence);
});

test("IntakeRouter.route confidence lower when no rules match", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Task", request: "abc123xyz" }));

  assert.ok(result.classification.confidence < 0.70);
});

// --- Route Trace ---

test("IntakeRouter.route populates routeTrace with decision details", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "Query", request: "what is status?" }));

  assert.ok(result.routeTrace.length > 0);
  assert.ok(result.routeTrace.some(t => t.startsWith("intent:")));
  assert.ok(result.routeTrace.some(t => t.startsWith("matched_keywords:")));
});

test("IntakeRouter.route includes confirmedTaskSpecId in trace", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    confirmedTaskSpecId: "spec_123",
  }));

  assert.ok(result.routeTrace.some(t => t.includes("confirmedTaskSpecId:spec_123")));
});

test("IntakeRouter.route includes tenantId in trace when present", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    tenantId: "tenant_abc",
  }));

  assert.ok(result.routeTrace.some(t => t.includes("tenantId:tenant_abc")));
});

test("IntakeRouter.route includes riskClass in trace when riskPreview provided", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    riskPreview: { riskClass: "high", reasons: [] },
  }));

  assert.ok(result.routeTrace.some(t => t.includes("riskClass:high")));
});

// --- Preferred Intent ---

test("IntakeRouter.route uses preferredIntent when confidence >= 0.80", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    preferredIntent: {
      intent: "create",
      confidence: 0.85,
      reasoning: "preferred by NL parser",
      source: "nl_intent_parser",
    },
  }));

  assert.equal(result.classification.intent, "create");
  assert.ok(result.routeTrace.some(t => t.includes("preferred_intent:create")));
});

test("IntakeRouter.route ignores preferredIntent when confidence < 0.80", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({
    title: "Task",
    request: "do something",
    preferredIntent: {
      intent: "create",
      confidence: 0.70,
      reasoning: "low confidence",
    },
  }));

  assert.notEqual(result.classification.intent, "create");
});

// --- Chinese Language Support ---

test("IntakeRouter.route handles Chinese query keywords", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "查询", request: "查看状态" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route handles Chinese create keywords", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "创建", request: "新建一个功能" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route handles Chinese modify keywords", async () => {
  const router = new IntakeRouter();
  const result = await router.route(createRouteInput({ title: "修复", request: "修复这个bug" }));

  assert.equal(result.classification.intent, "modify");
});

// --- Intent Type Constants ---

test("IntakeIntent type accepts all valid values", () => {
  const intents: IntakeIntent[] = ["query", "create", "modify", "approve", "cancel", "clarify", "chitchat", "correction"];
  for (const intent of intents) {
    assert.ok(["query", "create", "modify", "approve", "cancel", "clarify", "chitchat", "correction"].includes(intent));
  }
});

test("IntakeContinuation type accepts all valid values", () => {
  const continuations: IntakeContinuation[] = ["new_task", "follow_up", "correction"];
  for (const cont of continuations) {
    assert.ok(["new_task", "follow_up", "correction"].includes(cont));
  }
});
