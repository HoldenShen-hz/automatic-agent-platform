import assert from "node:assert/strict";
import test from "node:test";

import { IntakeRouter, type IntakeRouteInput } from "../../../../../src/platform/orchestration/routing/intake-router.js";
import type { DivisionRegistry, LoadedDivisionDefinition } from "../../../../../src/domains/governance/division-loader.js";

// ---------------------------------------------------------------------------
// Helper factories
// ---------------------------------------------------------------------------

function createMockDivision(overrides: Partial<LoadedDivisionDefinition> & { id: string }): LoadedDivisionDefinition {
  return {
    id: overrides.id,
    version: "1.0",
    name: overrides.name ?? overrides.id,
    priority: overrides.priority ?? 0,
    triggers: overrides.triggers ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId ?? "single_agent_minimal",
    orchestrationWorkflowId: overrides.orchestrationWorkflowId ?? "single_division_multi_step_orchestration",
    description: overrides.description ?? "Test division",
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
  return { divisions: divisionMap, workflows: new Map() };
}

function createRouteInput(overrides: Partial<IntakeRouteInput> = {}): IntakeRouteInput {
  return {
    title: overrides.title ?? "Test request",
    request: overrides.request ?? "",
  };
}

// ---------------------------------------------------------------------------
// Intake routing - basic intent classification
// ---------------------------------------------------------------------------

test("IntakeRouter.route classifies create intent from implement keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Task", request: "implement a new feature" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route classifies query intent from explain keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Help", request: "explain how the system works" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route classifies modify intent from refactor keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Code", request: "refactor the module" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route classifies approve intent from confirm keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Review", request: "confirm the changes are correct" }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route classifies cancel intent from terminate keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Stop", request: "terminate the process" }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route classifies clarify intent from be more specific phrase", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Help", request: "can you be more specific about the requirement" }));

  assert.equal(result.classification.intent, "clarify");
});

test("IntakeRouter.route classifies chitchat intent from thank you phrase", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Note", request: "thank you for your help" }));

  assert.equal(result.classification.intent, "chitchat");
});

test("IntakeRouter.route classifies correction intent from instead keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Fix", request: "actually use a different approach instead" }));

  assert.equal(result.classification.intent, "correction");
});

// ---------------------------------------------------------------------------
// Intake routing - queue/division selection
// ---------------------------------------------------------------------------

test("IntakeRouter.route selects division by trigger pattern", () => {
  const devopsDivision = createMockDivision({
    id: "devops",
    priority: 10,
    triggers: ["deploy", "release", "ship", "ci/cd"],
  });
  const registry = createMockRegistry([devopsDivision]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Deploy", request: "deploy to production" }));

  assert.equal(result.divisionId, "devops");
});

test("IntakeRouter.route selects division by highest priority when multiple match", () => {
  const lowPriDivision = createMockDivision({
    id: "low_pri",
    priority: 1,
    triggers: ["task", "work"],
  });
  const highPriDivision = createMockDivision({
    id: "high_pri",
    priority: 100,
    triggers: ["task", "work"],
  });
  const registry = createMockRegistry([lowPriDivision, highPriDivision]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Task", request: "do some work" }));

  assert.equal(result.divisionId, "high_pri");
});

test("IntakeRouter.route selects longest matching trigger", () => {
  const shortMatch = createMockDivision({
    id: "design",
    priority: 5,
    triggers: ["design"],
  });
  const longMatch = createMockDivision({
    id: "system_design",
    priority: 5,
    triggers: ["system design", "architecture"],
  });
  const registry = createMockRegistry([shortMatch, longMatch]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Design", request: "design the system architecture" }));

  assert.equal(result.divisionId, "system_design");
});

test("IntakeRouter.route handles pipe-separated trigger alternatives", () => {
  const division = createMockDivision({
    id: "release",
    priority: 10,
    triggers: ["deploy|release|ship"],
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Release", request: "release version 2.0" }));

  assert.equal(result.divisionId, "release");
});

test("IntakeRouter.route falls back to general_ops when no division matches", () => {
  const generalOps = createMockDivision({ id: "general_ops", priority: 0, triggers: [] });
  const registry = createMockRegistry([generalOps]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Unknown", request: "xyz123 abcdef" }));

  assert.equal(result.divisionId, "general_ops");
});

test("IntakeRouter.route uses default workflow when no orchestration needed", () => {
  const division = createMockDivision({
    id: "coding",
    priority: 10,
    triggers: ["code"],
    defaultWorkflowId: "simple_coding_workflow",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({ title: "Code", request: "fix typo" }));

  assert.equal(result.workflowId, "simple_coding_workflow");
  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route uses orchestration workflow when required", () => {
  const division = createMockDivision({
    id: "analysis",
    priority: 10,
    triggers: ["analyze", "review"],
    defaultWorkflowId: "simple_workflow",
    orchestrationWorkflowId: "multi_step_orchestration",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Analyze",
    request: "analyze the system performance and design optimization strategy",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "multi_step_orchestration");
});

// ---------------------------------------------------------------------------
// Intake routing - orchestration requirement detection
// ---------------------------------------------------------------------------

test("IntakeRouter.route triggers orchestration for 2+ orchestration hints", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Plan",
    request: "we need to plan and analyze the workflow and design the architecture",
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route triggers orchestration for long requests over 120 chars", () => {
  const router = new IntakeRouter();
  const longRequest = "This is a very long request that exceeds the threshold and should trigger orchestration because it contains a lot of text that suggests a complex multi-step task";
  const result = router.route(createRouteInput({ title: "Task", request: longRequest }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route does not trigger orchestration for short simple requests", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Quick", request: "do it now" }));

  assert.equal(result.requiresOrchestration, false);
});

test("IntakeRouter.route triggers orchestration for create with single hint and length > 80", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Build",
    request: "implement a comprehensive feature that requires multiple steps",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route triggers orchestration for modify with single hint and length > 80", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Refactor",
    request: "refactor the codebase to improve performance and maintainability across all modules",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route triggers orchestration for correction with hint and length > 80", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Fix",
    request: "actually the implementation needs to be corrected to handle edge cases properly",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route triggers orchestration for follow_up with 1+ hints", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Continue",
    request: "continue planning the implementation",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.continuation, "follow_up");
});

// ---------------------------------------------------------------------------
// Intake routing - continuation classification
// ---------------------------------------------------------------------------

test("IntakeRouter.route detects follow_up from continue keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Continue", request: "continue from where we left off" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route detects follow_up from next keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Next", request: "next, do the second step" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route detects follow_up from then keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Then", request: "then proceed with the analysis" }));

  assert.equal(result.classification.continuation, "follow_up");
});

test("IntakeRouter.route detects correction from correction keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Fix", request: "correction: the previous result was wrong" }));

  assert.equal(result.classification.continuation, "correction");
});

test("IntakeRouter.route returns new_task by default", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Task", request: "create a new widget" }));

  assert.equal(result.classification.continuation, "new_task");
});

// ---------------------------------------------------------------------------
// Intake routing - confidence scoring
// ---------------------------------------------------------------------------

test("IntakeRouter.route computes confidence within valid range 0.45-0.98", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is the status?" }));

  assert.ok(result.classification.confidence >= 0.45);
  assert.ok(result.classification.confidence <= 0.98);
});

test("IntakeRouter.route boosts confidence for query with question mark", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is it?" }));

  assert.ok(result.classification.confidence >= 0.52);
});

test("IntakeRouter.route boosts confidence for short chitchat", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Hi", request: "hello" }));

  assert.ok(result.classification.confidence >= 0.52);
});

test("IntakeRouter.route lowers confidence when no rules matched", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Task", request: "do something generic here" }));

  // Without clear intent keywords, confidence should be lower
  assert.ok(result.classification.confidence < 0.70);
});

// ---------------------------------------------------------------------------
// Intake routing - retry handling (continuation + new attempt)
// ---------------------------------------------------------------------------

test("IntakeRouter.route handles follow-up with orchestration for retry scenario", () => {
  const router = new IntakeRouter();
  // A follow-up that needs orchestration suggests retry/recovery scenario
  const result = router.route(createRouteInput({
    title: "Retry",
    request: "continue analyzing the problem and propose solutions",
  }));

  assert.equal(result.classification.continuation, "follow_up");
  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route handles correction as retry with modified approach", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Retry",
    request: "actually we need to approach this differently",
  }));

  assert.equal(result.classification.continuation, "correction");
  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route preserves requiresOrchestration for retry on complex task", () => {
  const division = createMockDivision({
    id: "complex",
    priority: 10,
    triggers: ["task"],
    defaultWorkflowId: "simple",
    orchestrationWorkflowId: "complex",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  // Retry scenario for an originally complex task
  const result = router.route(createRouteInput({
    title: "Continue",
    request: "continue analyzing and planning the multi-step workflow",
  }));

  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route classifies retry against existing context as follow_up", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Again",
    request: "based on that analysis, continue investigating the root cause",
  }));

  assert.equal(result.classification.continuation, "follow_up");
});

// ---------------------------------------------------------------------------
// Intake routing - route trace
// ---------------------------------------------------------------------------

test("IntakeRouter.route populates routeTrace with decision details", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "what is status?" }));

  assert.ok(result.routeTrace.length > 0);
  assert.ok(result.routeTrace.some(t => t.startsWith("intent:")));
  assert.ok(result.routeTrace.some(t => t.startsWith("matched_keywords:")));
  assert.ok(result.routeTrace.some(t => t.startsWith("matched_divisions:")));
});

test("IntakeRouter.route includes matched rules in trace", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "how do I create and build this" }));

  assert.ok(result.routeTrace.some(t => t.startsWith("matched_intent_rules:")));
});

test("IntakeRouter.route records routeReason as multi_step_or_high_context", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Task",
    request: "analyze and compare multiple approaches for the design",
  }));

  assert.equal(result.routeReason, "route.multi_step_or_high_context");
  assert.equal(result.requiresOrchestration, true);
});

test("IntakeRouter.route records routeReason as simple_request", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "Query", request: "status?" }));

  assert.equal(result.routeReason, "route.simple_request");
  assert.equal(result.requiresOrchestration, false);
});

// ---------------------------------------------------------------------------
// Intake routing - edge cases
// ---------------------------------------------------------------------------

test("IntakeRouter.route handles empty title and request", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "", request: "" }));

  assert.ok(result.classification.intent !== undefined);
  assert.ok(typeof result.requiresOrchestration === "boolean");
  assert.ok(Array.isArray(result.routeTrace));
});

test("IntakeRouter.route handles whitespace-only input", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "   ", request: "   " }));

  assert.ok(result.classification.intent !== undefined);
});

test("IntakeRouter.route handles null divisionRegistry gracefully", () => {
  const router = new IntakeRouter({ divisionRegistry: null });
  const result = router.route(createRouteInput({ title: "Test", request: "simple task" }));

  assert.ok(result.divisionId !== undefined);
  assert.ok(typeof result.workflowId === "string");
});

test("IntakeRouter.route returns correct IntakeRouteDecision structure", () => {
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

// ---------------------------------------------------------------------------
// Intake routing - Chinese keyword support
// ---------------------------------------------------------------------------

test("IntakeRouter.route handles Chinese create keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "创建", request: "创建一个新功能" }));

  assert.equal(result.classification.intent, "create");
});

test("IntakeRouter.route handles Chinese modify keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "修复", request: "修复这个bug" }));

  assert.equal(result.classification.intent, "modify");
});

test("IntakeRouter.route handles Chinese query keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "查询", request: "查看状态信息" }));

  assert.equal(result.classification.intent, "query");
});

test("IntakeRouter.route handles Chinese cancel keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "取消", request: "撤销操作" }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route handles Chinese approve keyword", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({ title: "审批", request: "批准通过" }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route handles Chinese orchestration hint", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "分析",
    request: "分析系统性能设计优化策略实施修复",
  }));

  assert.equal(result.requiresOrchestration, true);
});

// ---------------------------------------------------------------------------
// Intake routing - priority over other intents
// ---------------------------------------------------------------------------

test("IntakeRouter.route correction takes priority over create", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Build",
    request: "actually that implementation is wrong, correct it",
  }));

  assert.equal(result.classification.intent, "correction");
});

test("IntakeRouter.route cancel takes priority over query", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Stop",
    request: "cancel the query operation",
  }));

  assert.equal(result.classification.intent, "cancel");
});

test("IntakeRouter.route approve takes priority over create", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Build",
    request: "approved, go ahead with the build",
  }));

  assert.equal(result.classification.intent, "approve");
});

test("IntakeRouter.route clarify takes priority over chitchat", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Hello",
    request: "clarify what you meant by that",
  }));

  assert.equal(result.classification.intent, "clarify");
});

// ---------------------------------------------------------------------------
// Intake routing - matchedRules content
// ---------------------------------------------------------------------------

test("IntakeRouter.route matchedRules contains keywords that triggered intent", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Query",
    request: "how do I create and build this",
  }));

  const matchedRules = result.classification.matchedRules;
  assert.ok(matchedRules.length > 0);
  assert.ok(matchedRules.some(rule => rule.includes("create") || rule.includes("build")));
});

test("IntakeRouter.route matchedRules includes follow_up keywords when applicable", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Continue",
    request: "continue and also proceed further",
  }));

  assert.ok(result.classification.matchedRules.some(rule => rule.includes("continue") || rule.includes("also")));
});

// ---------------------------------------------------------------------------
// Intake routing - workflow selection based on division config
// ---------------------------------------------------------------------------

test("IntakeRouter.route uses division's orchestrationWorkflowId when orchestration required", () => {
  const division = createMockDivision({
    id: "engineering",
    priority: 10,
    triggers: ["engineer", "develop"],
    defaultWorkflowId: "simple_dev",
    orchestrationWorkflowId: "orchestrated_dev",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Engineer",
    request: "design and implement the new service architecture",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "orchestrated_dev");
  assert.equal(result.divisionId, "engineering");
});

test("IntakeRouter.route uses division's defaultWorkflowId when no orchestration", () => {
  const division = createMockDivision({
    id: "support",
    priority: 10,
    triggers: ["help", "support"],
    defaultWorkflowId: "support_agent",
    orchestrationWorkflowId: "orchestrated_support",
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Help",
    request: "how do I reset my password",
  }));

  assert.equal(result.requiresOrchestration, false);
  assert.equal(result.workflowId, "support_agent");
  assert.equal(result.divisionId, "support");
});

test("IntakeRouter.route falls back to default orchestration workflow when division has none", () => {
  const division = createMockDivision({
    id: "basic",
    priority: 10,
    triggers: ["task"],
    defaultWorkflowId: "basic",
    // no orchestrationWorkflowId - uses fallback
  });
  const registry = createMockRegistry([division]);
  const router = new IntakeRouter({ divisionRegistry: registry });

  const result = router.route(createRouteInput({
    title: "Task",
    request: "plan and analyze this complex workflow",
  }));

  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.workflowId, "single_division_multi_step_orchestration");
});

test("IntakeRouter.route falls back to single_agent_minimal when no division matches and no orchestration", () => {
  const router = new IntakeRouter();
  const result = router.route(createRouteInput({
    title: "Simple",
    request: "do this",
  }));

  assert.equal(result.requiresOrchestration, false);
  assert.equal(result.workflowId, "single_agent_minimal");
  assert.equal(result.divisionId, "general_ops");
});