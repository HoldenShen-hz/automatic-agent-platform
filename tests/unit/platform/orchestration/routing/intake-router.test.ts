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
  };
}

test("IntakeRouter.route classifies simple query intent from what keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is the status?" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route classifies create intent from build keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "New task", request: "build a new feature" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route classifies modify intent from fix keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Update", request: "fix the bug in module x" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route classifies approve intent from ship it phrase", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Approval", request: "ship it" }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route classifies cancel intent from abort keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Cancel", request: "abort the operation" }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route classifies clarify intent from clarification keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Clarify", request: "please clarify what you mean" }));

  assert.equal(result.classification.intent, "clarify");
});

test("IntakeRouter.route classifies chitchat intent from hello keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Hello", request: "hello there" }));

  assert.equal(result.classification.intent, "chitchat");
});

test("IntakeRouter.route classifies correction intent from actually keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Fix", request: "actually that is wrong" }));

  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route detects follow_up continuation from continue keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Continue", request: "continue from where we left off" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route returns new_task continuation by default", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Task", request: "do something" }));

  assert.equal(result.classification.continuation, "new_task");
});

test("IntakeRouter.route sets requiresOrchestration true when 2+ orchestration hints present", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Plan and analyze",
    request: "we need to plan and analyze the architecture",
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route sets requiresOrchestration true for long requests over 120 chars", () => {
  const router = new IntakeRouter();
  const longRequest = "a".repeat(150);
  const result = router.route(createRouteInput({ title: "Task", request: longRequest }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route sets requiresOrchestration false for short simple requests", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Quick task", request: "do this" }));

  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route selects division based on trigger pattern matching", () => {
  const codingDivision = createMockDivision({
    id: "coding",
    priority: 10,
    triggers: ["code", "programming", "implement"],
  });
  const registry = createMockRegistry([codingDivision]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Code", request: "implement a feature" }));

  assert.equal(result.divisionId, "coding");
});

test("IntakeRouter.route selects higher priority division when multiple match", () => {
  const lowPriority = createMockDivision({
    id: "low",
    priority: 1,
    triggers: ["task", "work"],
  });
  const highPriority = createMockDivision({
    id: "high",
    priority: 100,
    triggers: ["task", "work"],
  });
  const registry = createMockRegistry([lowPriority, highPriority]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Task", request: "do some work" }));

  assert.equal(result.divisionId, "high");
});

test("IntakeRouter.route falls back to general_ops when no division matches", () => {
  const generalOps = createMockDivision({ id: "general_ops", priority: 0, triggers: [] });
  const registry = createMockRegistry([generalOps]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Unknown", request: "xyz123" }));

  assert.equal(result.divisionId, "general_ops");
});

test("IntakeRouter.route uses default workflow for simple requests", () => {
  const division = createMockDivision({
    id: "test_div",
    priority: 10,
    triggers: ["test"],
    defaultWorkflowId: "my_default_workflow",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Test", request: "simple test" }));

  assert.equal(result.workflowId, "my_default_workflow");
  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route uses orchestration workflow when orchestration is required", () => {
  const division = createMockDivision({
    id: "test_div",
    priority: 10,
    triggers: ["test"],
    defaultWorkflowId: "simple_wf",
    orchestrationWorkflowId: "orchestration_wf",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Test",
    request: "plan and analyze this task which is quite long and requires multiple steps",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "orchestration_wf");
});

test("IntakeRouter.route populates routeTrace with decision details", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is status?" }));

  assert.ok(result.routeTrace.length > 0);
  assert.ok(result.routeTrace.some(t => t.startsWith("intent:")));
  assert.ok(result.routeTrace.some(t => t.startsWith("matched_keywords:")));
});

test("IntakeRouter.route computes confidence score within valid range 0.45-0.98", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is the status?" }));

  assert.ok(result.classification.confidence >= 0.45);
  assert.ok(result.classification.confidence <= 0.98);
});

test("IntakeRouter.route handles Chinese keywords for query intent", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "查询", request: "查看状态" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route handles Chinese keywords for create intent", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "创建", request: "新建一个功能" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route handles Chinese keywords for modify intent", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "修复", request: "修复这个bug" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route selects longest matching trigger when multiple divisions match", () => {
  const shortMatch = createMockDivision({
    id: "code",
    priority: 5,
    triggers: ["code"],
  });
  const longMatch = createMockDivision({
    id: "code_quality",
    priority: 5,
    triggers: ["code quality", "code review"],
  });
  const registry = createMockRegistry([shortMatch, longMatch]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Code", request: "improve code quality" }));

  assert.equal(result.divisionId, "code_quality");
});

test("IntakeRouter.route handles division with pipe-separated trigger alternatives", () => {
  const division = createMockDivision({
    id: "devops",
    priority: 10,
    triggers: ["deploy|release|ship"],
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Deploy", request: "deploy to production" }));

  assert.equal(result.divisionId, "devops");
});

test("IntakeRouter.route returns routeReason indicating multi_step_or_high_context", () => {
  const division = createMockDivision({
    id: "test",
    priority: 5,
    triggers: [],
    orchestrationWorkflowId: "orch_wf",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Test",
    request: "plan and design the architecture for the system",
  }));

  assert.equal(result.routeReason, "route.multi_step_or_high_context");
});

test("IntakeRouter.route returns routeReason indicating simple_request", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "status?" }));

  assert.equal(result.routeReason, "route.simple_request");
});

test("IntakeRouter.route returns IntakeRouteDecision with correct structure", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Test", request: "simple" }));

  assert.ok(typeof result.workflowId === "string");
  assert.ok(typeof result.divisionId === "string");
  assert.ok(typeof result.routeReason === "string");
  assert.ok(Array.isArray(result.routeTrace));
  assert.ok(typeof result.requiresOrchestration === "boolean");
  assert.ok(result.classification !== undefined);
  assert.ok(typeof result.classification.intent === "string");
  assert.ok(typeof result.classification.continuation === "string");
  assert.ok(typeof result.classification.confidence === "number");
  assert.ok(Array.isArray(result.classification.matchedRules));
});

test("IntakeRouter.route triggers orchestration for follow_up with 2+ hints", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Continue",
    request: "continue planning and analyzing the workflow",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route handles query with question mark for confidence boost", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is it?" }));

  assert.ok(result.classification.confidence >= 0.52);
});

test("IntakeRouter.route handles create/modify intents with orchestration hints", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Build",
    request: "implement a new service",
  }));

  assert.equal(result.classification.intent, "create");
  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route with null divisionRegistry uses default registry", () => {
  const router = new IntakeRouter({ divisionRegistry: null });

  const result = router.route(createRouteInput({ title: "Test", request: "simple request" }));

  assert.ok(result.divisionId !== undefined);
});

test("IntakeRouter.route handles cancel keyword from 撤销 Chinese", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "取消", request: "撤销操作" }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route handles approve keyword from 批准 Chinese", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "审批", request: "批准通过" }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route handles empty request string gracefully", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "", request: "" }));

  assert.ok(result.classification.intent !== undefined);
  assert.ok(typeof result.requiresOrchestration === "boolean");
});

test("IntakeRouter.route handles long Chinese input for orchestration", () => {
  const router = new IntakeRouter();
  const longChinese = "分析当前系统性能识别瓶颈比较基准测试设计优化策略实施修复并向利益相关者总结结果";
  const result = router.route(createRouteInput({ title: "分析", request: longChinese }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route applies correction priority over other intents", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Fix",
    request: "actually this needs to be corrected",
  }));

  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route applies cancel priority over query", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Stop",
    request: "cancel the query",
  }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route matchedRules contains all matched intent keywords", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Query",
    request: "how do I create and build this",
  }));

  assert.ok(result.classification.matchedRules.length > 0);
});
