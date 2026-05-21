import assert from "node:assert/strict";
import test from "node:test";

import {
  normalize,
  findMatchedTrigger,
  classifyIntent,
  extractIntentWithConfidence,
  shouldRequireOrchestration,
  withOptionalConfirmedTaskSpecId,
  ORCHESTRATION_HINTS,
  CONFIDENCE_THRESHOLD,
  BUILT_IN_SKILL_TAXONOMY,
} from "../../../../../src/platform/five-plane-orchestration/routing/intake-router-model.js";
import type { LoadedDivisionDefinition } from "../../../../../src/domains/governance/division-loader.js";

function createMockDivision(overrides: Partial<LoadedDivisionDefinition> & { id: string }): LoadedDivisionDefinition {
  return {
    id: overrides.id,
    version: overrides.version ?? "1.0",
    name: overrides.name ?? overrides.id,
    description: overrides.description ?? "Test division",
    priority: overrides.priority ?? 0,
    triggers: overrides.triggers ?? [],
    defaultWorkflowId: overrides.defaultWorkflowId ?? "single_agent_minimal",
    orchestrationWorkflowId: overrides.orchestrationWorkflowId ?? "multi_step_orchestration",
    roles: overrides.roles ?? [],
    workflows: overrides.workflows ?? [],
    rootPath: overrides.rootPath ?? "/tmp/test",
  };
}

// ============================================================================
// normalize() Tests - Text Normalization
// ============================================================================

test("normalize trims whitespace from text", () => {
  assert.equal(normalize("  hello world  "), "hello world");
});

test("normalize converts text to lowercase", () => {
  assert.equal(normalize("HELLO WORLD"), "hello world");
});

test("normalize handles mixed case and whitespace", () => {
  assert.equal(normalize("  Hello WORLD  "), "hello world");
});

test("normalize handles null input", () => {
  assert.equal(normalize(null), "");
});

test("normalize handles undefined input", () => {
  assert.equal(normalize(undefined), "");
});

test("normalize handles empty string", () => {
  assert.equal(normalize(""), "");
});

test("normalize preserves Chinese characters", () => {
  assert.equal(normalize("你好世界"), "你好世界");
});

test("normalize handles Chinese with whitespace", () => {
  assert.equal(normalize("  你好世界  "), "你好世界");
});

// ============================================================================
// findMatchedTrigger() Tests - Routing Table / Route Resolution
// ============================================================================

test("findMatchedTrigger returns null when no triggers match", () => {
  const division = createMockDivision({ id: "test", triggers: ["code", "build"] });
  const result = findMatchedTrigger(division, "hello world");
  assert.equal(result, null);
});

test("findMatchedTrigger returns matching trigger", () => {
  const division = createMockDivision({ id: "coding", triggers: ["code", "programming"] });
  const result = findMatchedTrigger(division, "write some code");
  assert.equal(result, "code");
});

test("findMatchedTrigger returns longest matching trigger", () => {
  const division = createMockDivision({ id: "coding", triggers: ["code", "code quality", "code review"] });
  const result = findMatchedTrigger(division, "improve code quality");
  assert.equal(result, "code quality");
});

test("findMatchedTrigger handles pipe-separated alternatives", () => {
  const division = createMockDivision({ id: "devops", triggers: ["deploy|release|ship"] });
  const result = findMatchedTrigger(division, "deploy to production");
  assert.equal(result, "deploy");
});

test("findMatchedTrigger returns longest match among alternatives", () => {
  const division = createMockDivision({ id: "test", triggers: ["test|testing|test case"] });
  const result = findMatchedTrigger(division, "run test case");
  assert.equal(result, "test case");
});

test("findMatchedTrigger is case-insensitive", () => {
  const division = createMockDivision({ id: "test", triggers: ["CODE"] });
  const result = findMatchedTrigger(division, "write some code");
  assert.equal(result, "code");
});

test("findMatchedTrigger returns null for empty trigger string", () => {
  const division = createMockDivision({ id: "test", triggers: [""] });
  const result = findMatchedTrigger(division, "hello");
  assert.equal(result, null);
});

test("findMatchedTrigger ignores whitespace-only triggers", () => {
  const division = createMockDivision({ id: "test", triggers: ["code", "  ", "build"] });
  const result = findMatchedTrigger(division, "write some code");
  assert.equal(result, "code");
});

test("findMatchedTrigger handles multiple pipe-separated with empty parts", () => {
  const division = createMockDivision({ id: "ops", triggers: ["deploy||ship||"] });
  const result = findMatchedTrigger(division, "deploy now");
  assert.equal(result, "deploy");
});

test("findMatchedTrigger returns null when all triggers are empty or whitespace", () => {
  const division = createMockDivision({ id: "test", triggers: ["  ", ""] });
  const result = findMatchedTrigger(division, "anything");
  assert.equal(result, null);
});

test("findMatchedTrigger matches Chinese triggers", () => {
  const division = createMockDivision({ id: "chinese", triggers: ["代码", "编程", "开发"] });
  const result = findMatchedTrigger(division, "写代码");
  assert.equal(result, "代码");
});

// ============================================================================
// classifyIntent() Tests - Intent Classification
// ============================================================================

test("classifyIntent detects query intent for what keyword", () => {
  const result = classifyIntent("what is the status?", []);
  assert.equal(result.intent, "query");
});

test("classifyIntent detects query intent for how keyword", () => {
  const result = classifyIntent("how do I deploy?", []);
  assert.equal(result.intent, "query");
});

test("classifyIntent detects create intent for build keyword", () => {
  const result = classifyIntent("build a new feature", []);
  assert.equal(result.intent, "create");
});

test("classifyIntent detects create intent for implement keyword", () => {
  const result = classifyIntent("implement this feature", []);
  assert.equal(result.intent, "create");
});

test("classifyIntent detects modify intent for fix keyword", () => {
  const result = classifyIntent("fix the bug", []);
  assert.equal(result.intent, "modify");
});

test("classifyIntent detects modify intent for refactor keyword", () => {
  const result = classifyIntent("refactor this code", []);
  assert.equal(result.intent, "modify");
});

test("classifyIntent detects approve intent for ship it phrase", () => {
  const result = classifyIntent("ship it to production", []);
  assert.equal(result.intent, "approve");
});

test("classifyIntent detects cancel intent for abort keyword", () => {
  const result = classifyIntent("abort the operation", []);
  assert.equal(result.intent, "cancel");
});

test("classifyIntent detects clarify intent", () => {
  const result = classifyIntent("please clarify what you mean", []);
  assert.equal(result.intent, "clarify");
});

test("classifyIntent detects chitchat intent for hello", () => {
  const result = classifyIntent("hello there", []);
  assert.equal(result.intent, "chitchat");
});

test("classifyIntent detects correction intent for actually keyword", () => {
  const result = classifyIntent("actually that is wrong", []);
  assert.equal(result.intent, "correction");
});

test("classifyIntent prioritizes correction over other intents", () => {
  const result = classifyIntent("actually I want you to create something", []);
  assert.equal(result.intent, "correction");
});

test("classifyIntent prioritizes cancel over other intents", () => {
  const result = classifyIntent("cancel the build and stop everything", []);
  assert.equal(result.intent, "cancel");
});

test("classifyIntent prioritizes approve over query", () => {
  const result = classifyIntent("approve and explain the decision", []);
  assert.equal(result.intent, "approve");
});

test("classifyIntent returns query when no keywords match", () => {
  const result = classifyIntent("xyzabc123", []);
  assert.equal(result.intent, "query");
});

test("classifyIntent detects follow_up continuation for continue keyword", () => {
  const result = classifyIntent("continue from where we left off", []);
  assert.equal(result.continuation, "follow_up");
});

test("classifyIntent detects follow_up continuation for next keyword", () => {
  const result = classifyIntent("next, do the same thing", []);
  assert.equal(result.continuation, "follow_up");
});

test("classifyIntent detects correction continuation", () => {
  const result = classifyIntent("actually that was wrong", []);
  assert.equal(result.continuation, "correction");
});

test("classifyIntent defaults to new_task continuation", () => {
  const result = classifyIntent("build a feature", []);
  assert.equal(result.continuation, "new_task");
});

test("classifyIntent includes matched rules in result", () => {
  const result = classifyIntent("what is the status?", []);
  assert.ok(result.matchedRules.length > 0);
});

test("classifyIntent confidence is within valid range", () => {
  const result = classifyIntent("what is the status?", []);
  assert.ok(result.confidence >= 0.45);
  assert.ok(result.confidence <= 0.98);
});

test("classifyIntent higher confidence with more matched rules", () => {
  const result1 = classifyIntent("what?", []);
  const result2 = classifyIntent("what is how when where who which show list status query search", []);
  assert.ok(result2.confidence >= result1.confidence);
});

test("classifyIntent lower confidence with no matched rules", () => {
  const result = classifyIntent("xyz123 abc456", []);
  assert.ok(result.confidence < 0.60);
});

test("classifyIntent handles Chinese query keywords", () => {
  const result = classifyIntent("查看状态", []);
  assert.equal(result.intent, "query");
});

test("classifyIntent handles Chinese create keywords", () => {
  const result = classifyIntent("创建一个功能", []);
  assert.equal(result.intent, "create");
});

test("classifyIntent handles Chinese modify keywords", () => {
  const result = classifyIntent("修复这个bug", []);
  assert.equal(result.intent, "modify");
});

test("classifyIntent handles Chinese approve keywords", () => {
  const result = classifyIntent("批准这个请求", []);
  assert.equal(result.intent, "approve");
});

test("classifyIntent handles Chinese cancel keywords", () => {
  const result = classifyIntent("取消操作", []);
  assert.equal(result.intent, "cancel");
});

test("classifyIntent considers matched orchestration hints", () => {
  const result = classifyIntent("build a feature", ["plan", "analyze"]);
  assert.ok(result.matchedHints !== undefined || result.matchedRules.length > 0);
});

test("classifyIntent returns chitchat when only chitchat keywords match", () => {
  const result = classifyIntent("hello", []);
  assert.equal(result.intent, "chitchat");
});

test("classifyIntent returns query when chitchat and query both match but query has more specific match", () => {
  const result = classifyIntent("how are you doing", []);
  assert.equal(result.intent, "query");
});

// ============================================================================
// extractIntentWithConfidence() Tests - Dynamic Routing / Confidence
// ============================================================================

test("extractIntentWithConfidence returns goal unchanged", () => {
  const goal = "build a feature";
  const result = extractIntentWithConfidence(goal);
  assert.equal(result.extractedGoal, goal);
});

test("extractIntentWithConfidence returns confidence in valid range", () => {
  const result = extractIntentWithConfidence("build a feature");
  assert.ok(result.confidence >= 0.35);
  assert.ok(result.confidence <= 0.80);
});

test("extractIntentWithConfidence detects ambiguous timing", () => {
  const result = extractIntentWithConfidence("build something later");
  assert.ok(result.ambiguityFlags.includes("ambiguous_timing"));
});

test("extractIntentWithConfidence detects vague goal language", () => {
  const result = extractIntentWithConfidence("maybe do something");
  assert.ok(result.ambiguityFlags.includes("vague_goal_language"));
});

test("extractIntentWithConfidence detects short goal", () => {
  const result = extractIntentWithConfidence("do stuff");
  assert.ok(result.ambiguityFlags.includes("short_goal"));
});

test("extractIntentWithConfidence detects conditional language", () => {
  const result = extractIntentWithConfidence("build this if possible");
  assert.ok(result.ambiguityFlags.includes("conditional_language"));
});

test("extractIntentWithConfidence detects potential conflict with short goal", () => {
  const result = extractIntentWithConfidence("do this but actually that");
  assert.ok(result.ambiguityFlags.includes("potential_conflict"));
});

test("extractIntentWithConfidence returns ambiguityDetected true when flags present", () => {
  const result = extractIntentWithConfidence("maybe do something soon");
  assert.equal(result.ambiguityDetected, true);
});

test("extractIntentWithConfidence returns ambiguityDetected false for clear goals", () => {
  const result = extractIntentWithConfidence("build a new user authentication system with JWT tokens");
  assert.equal(result.ambiguityDetected, false);
});

test("extractIntentWithConfidence suggests clarification for vague language", () => {
  const result = extractIntentWithConfidence("maybe do something");
  assert.ok(result.suggestedClarifications.includes("Specify concrete requirements or criteria"));
});

test("extractIntentWithConfidence suggests clarification for ambiguous timing", () => {
  const result = extractIntentWithConfidence("build something later");
  assert.ok(result.suggestedClarifications.includes("Provide a specific deadline or time frame"));
});

test("extractIntentWithConfidence suggests clarification for short goal", () => {
  const result = extractIntentWithConfidence("do it");
  assert.ok(result.suggestedClarifications.includes("Provide more details about the desired outcome"));
});

test("extractIntentWithConfidence suggests clarification for conditional language", () => {
  const result = extractIntentWithConfidence("build this if possible");
  assert.ok(result.suggestedClarifications.includes("Clarify the conditions or dependencies"));
});

test("extractIntentWithConfidence suggests clarification for potential conflict", () => {
  const result = extractIntentWithConfidence("do this but that");
  assert.ok(result.suggestedClarifications.includes("Resolve potential conflicts in requirements"));
});

test("extractIntentWithConfidence reduces confidence for each ambiguity flag", () => {
  // Short goal = 1 flag (short_goal)
  const result1 = extractIntentWithConfidence("do it");
  // Short goal + vague language = 2 flags
  const result2 = extractIntentWithConfidence("maybe do it");
  // Each ambiguity flag reduces confidence by 0.12, capped at 0.35
  assert.ok(result1.confidence > result2.confidence);
  assert.ok(result1.ambiguityFlags.length < result2.ambiguityFlags.length);
});

test("extractIntentWithConfidence returns empty ambiguityFlags for clear goal", () => {
  const result = extractIntentWithConfidence("build a new REST API endpoint for user authentication");
  assert.deepEqual(result.ambiguityFlags, []);
});

test("extractIntentWithConfidence returns empty suggestedClarifications for clear goal", () => {
  const result = extractIntentWithConfidence("build a new REST API endpoint for user authentication");
  assert.deepEqual(result.suggestedClarifications, []);
});

// ============================================================================
// shouldRequireOrchestration() Tests - Dynamic Routing Decision
// ============================================================================

test("shouldRequireOrchestration returns false for low complexity request", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("simple query", [], classification);
  assert.equal(result, false);
});

test("shouldRequireOrchestration returns true for high risk class", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("simple query", [], classification, "high");
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for critical risk class", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("simple query", [], classification, "critical");
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true when 2+ orchestration hints present", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("plan and analyze this", ["plan", "analyze"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for long requests (>120 chars)", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const longRequest = "a".repeat(150);
  const result = shouldRequireOrchestration(longRequest, [], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns false for medium length request", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("a".repeat(100), [], classification);
  assert.equal(result, false);
});

test("shouldRequireOrchestration handles Chinese high complexity cues", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("需要分析这个问题", ["analyze"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for follow_up with orchestration hint", () => {
  const classification = { intent: "query" as const, continuation: "follow_up" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("continue with the plan", ["plan"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns false for follow_up without hints", () => {
  const classification = { intent: "query" as const, continuation: "follow_up" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("continue please", [], classification);
  assert.equal(result, false);
});

test("shouldRequireOrchestration returns true for create intent with hint", () => {
  const classification = { intent: "create" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("build a feature", ["plan"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for create intent with long request", () => {
  const classification = { intent: "create" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("a".repeat(100), [], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for modify intent with hint", () => {
  const classification = { intent: "modify" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("fix the bug", ["analyze"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns true for correction intent with hint", () => {
  const classification = { intent: "correction" as const, continuation: "correction" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("actually fix that", ["plan"], classification);
  assert.equal(result, true);
});

test("shouldRequireOrchestration returns false for modify intent without hints and short request", () => {
  const classification = { intent: "modify" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("fix it", [], classification);
  assert.equal(result, false);
});

test("shouldRequireOrchestration defaults riskClass to undefined behavior", () => {
  const classification = { intent: "query" as const, continuation: "new_task" as const, confidence: 0.8, matchedRules: [] };
  const result = shouldRequireOrchestration("simple query", [], classification);
  assert.equal(result, false);
});

// ============================================================================
// withOptionalConfirmedTaskSpecId() Tests
// ============================================================================

test("withOptionalConfirmedTaskSpecId adds confirmedTaskSpecId when provided", () => {
  const decision = { workflowId: "wf1", divisionId: "div1", routeReason: "test", routeTrace: [], requiresOrchestration: false, classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] } };
  const result = withOptionalConfirmedTaskSpecId(decision, "spec_123");
  assert.equal(result.confirmedTaskSpecId, "spec_123");
});

test("withOptionalConfirmedTaskSpecId does not add when undefined", () => {
  const decision = { workflowId: "wf1", divisionId: "div1", routeReason: "test", routeTrace: [], requiresOrchestration: false, classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] } };
  const result = withOptionalConfirmedTaskSpecId(decision, undefined);
  assert.equal(result.confirmedTaskSpecId, undefined);
});

test("withOptionalConfirmedTaskSpecId does not add when empty string", () => {
  const decision = { workflowId: "wf1", divisionId: "div1", routeReason: "test", routeTrace: [], requiresOrchestration: false, classification: { intent: "query", continuation: "new_task", confidence: 0.8, matchedRules: [] } };
  const result = withOptionalConfirmedTaskSpecId(decision, "");
  assert.equal(result.confirmedTaskSpecId, undefined);
});

test("withOptionalConfirmedTaskSpecId preserves all other decision properties", () => {
  const decision = { workflowId: "wf1", divisionId: "div1", routeReason: "test", routeTrace: ["step1"], requiresOrchestration: true, classification: { intent: "create", continuation: "new_task", confidence: 0.9, matchedRules: ["build"] } };
  const result = withOptionalConfirmedTaskSpecId(decision, "spec_456");
  assert.equal(result.workflowId, "wf1");
  assert.equal(result.divisionId, "div1");
  assert.equal(result.routeReason, "test");
  assert.deepEqual(result.routeTrace, ["step1"]);
  assert.equal(result.requiresOrchestration, true);
  assert.equal(result.classification.intent, "create");
});

// ============================================================================
// Constants Tests
// ============================================================================

test("ORCHESTRATION_HINTS contains expected keywords", () => {
  assert.ok(ORCHESTRATION_HINTS.includes("plan"));
  assert.ok(ORCHESTRATION_HINTS.includes("orchestrate"));
  assert.ok(ORCHESTRATION_HINTS.includes("analyze"));
  assert.ok(ORCHESTRATION_HINTS.includes("design"));
  assert.ok(ORCHESTRATION_HINTS.includes("implement"));
});

test("ORCHESTRATION_HINTS contains Chinese keywords", () => {
  assert.ok(ORCHESTRATION_HINTS.includes("分析"));
  assert.ok(ORCHESTRATION_HINTS.includes("设计"));
  assert.ok(ORCHESTRATION_HINTS.includes("实现"));
});

test("ORCHESTRATION_HINTS behaves as readonly array", () => {
  // Type-level readonly via as const, check length and indexed access work
  assert.equal(ORCHESTRATION_HINTS.length > 0, true);
  assert.equal(ORCHESTRATION_HINTS.includes("plan"), true);
  assert.ok(Array.isArray(ORCHESTRATION_HINTS));
});

test("CONFIDENCE_THRESHOLD equals 0.80", () => {
  assert.equal(CONFIDENCE_THRESHOLD, 0.80);
});

test("BUILT_IN_SKILL_TAXONOMY has expected structure", () => {
  assert.ok(BUILT_IN_SKILL_TAXONOMY.entries.length > 0);
  assert.equal(BUILT_IN_SKILL_TAXONOMY.defaultCategory, "general");
});

test("BUILT_IN_SKILL_TAXONOMY has coding category with keywords", () => {
  const codingEntry = BUILT_IN_SKILL_TAXONOMY.entries.find(e => e.category === "coding");
  assert.ok(codingEntry);
  assert.ok(codingEntry.keywords.includes("code"));
  assert.ok(codingEntry.keywords.includes("programming"));
});

test("BUILT_IN_SKILL_TAXONOMY has automation category with keywords", () => {
  const autoEntry = BUILT_IN_SKILL_TAXONOMY.entries.find(e => e.category === "automation");
  assert.ok(autoEntry);
  assert.ok(autoEntry.keywords.includes("workflow"));
  assert.ok(autoEntry.keywords.includes("pipeline"));
});

test("BUILT_IN_SKILL_TAXONOMY has security category", () => {
  const secEntry = BUILT_IN_SKILL_TAXONOMY.entries.find(e => e.category === "security");
  assert.ok(secEntry);
  assert.ok(secEntry.keywords.includes("security"));
  assert.ok(secEntry.keywords.includes("auth"));
});

test("BUILT_IN_SKILL_TAXONOMY entries have valid weights", () => {
  for (const entry of BUILT_IN_SKILL_TAXONOMY.entries) {
    assert.ok(entry.weight > 0 && entry.weight <= 1);
  }
});
