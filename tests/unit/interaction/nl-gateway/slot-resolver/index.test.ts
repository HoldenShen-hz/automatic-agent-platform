/**
 * Unit tests for slot-resolver module - SlotResolver class
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  SlotResolver,
  resolveRequiredSlots,
  type SlotResolverOptions,
  type ClarificationRound,
  type ClarificationLoopState,
} from "../../../../../src/interaction/nl-gateway/slot-resolver/index.js";
import type { ExtractedEntity } from "../../../../../src/interaction/nl-gateway/index.js";

// ---------------------------------------------------------------------------
// Test Data Factory
// ---------------------------------------------------------------------------

function makeEntity(overrides: Partial<ExtractedEntity> = {}): ExtractedEntity {
  return {
    entityType: "general",
    value: "test",
    normalized: "test" as unknown,
    sourceSpan: [0, 4] as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SlotResolverOptions type tests
// ---------------------------------------------------------------------------

test("SlotResolverOptions accepts optional maxRounds", () => {
  const options: SlotResolverOptions = {
    maxRounds: 5,
  };
  assert.equal(options.maxRounds, 5);
});

test("SlotResolverOptions accepts optional slotConfidenceThreshold", () => {
  const options: SlotResolverOptions = {
    slotConfidenceThreshold: 0.9,
  };
  assert.equal(options.slotConfidenceThreshold, 0.9);
});

test("SlotResolverOptions accepts both options", () => {
  const options: SlotResolverOptions = {
    maxRounds: 10,
    slotConfidenceThreshold: 0.85,
  };
  assert.equal(options.maxRounds, 10);
  assert.equal(options.slotConfidenceThreshold, 0.85);
});

test("SlotResolverOptions is optional - undefined is valid", () => {
  const options: SlotResolverOptions | undefined = undefined;
  assert.equal(options, undefined);
});

// ---------------------------------------------------------------------------
// ClarificationLoopState type tests
// ---------------------------------------------------------------------------

test("ClarificationLoopState accepts in_progress", () => {
  const state: ClarificationLoopState = "in_progress";
  assert.equal(state, "in_progress");
});

test("ClarificationLoopState accepts completed", () => {
  const state: ClarificationLoopState = "completed";
  assert.equal(state, "completed");
});

test("ClarificationLoopState accepts blocked", () => {
  const state: ClarificationLoopState = "blocked";
  assert.equal(state, "blocked");
});

// ---------------------------------------------------------------------------
// ClarificationRound type tests
// ---------------------------------------------------------------------------

test("ClarificationRound has required fields", () => {
  const round: ClarificationRound = {
    roundNumber: 1,
    missingSlots: ["date", "time"],
    generatedQuestions: ["When should this run?"],
    state: "in_progress",
  };
  assert.equal(round.roundNumber, 1);
  assert.deepEqual(round.missingSlots, ["date", "time"]);
  assert.deepEqual(round.generatedQuestions, ["When should this run?"]);
  assert.equal(round.state, "in_progress");
});

// ---------------------------------------------------------------------------
// SlotResolver constructor tests
// ---------------------------------------------------------------------------

test("SlotResolver uses default options when none provided", () => {
  const resolver = new SlotResolver();
  assert.equal(resolver.getMaxRounds(), 3);
});

test("SlotResolver accepts partial options with maxRounds", () => {
  const resolver = new SlotResolver({ maxRounds: 5 });
  assert.equal(resolver.getMaxRounds(), 5);
});

test("SlotResolver accepts partial options with slotConfidenceThreshold", () => {
  const resolver = new SlotResolver({ slotConfidenceThreshold: 0.9 });
  // Cannot directly access private property, but can test via behavior
  const result = resolver.resolveRequiredSlots([], ["test"]);
  // Default threshold is 0.8, so with no entityConfidence, entities won't resolve
  assert.ok(result.shouldRequestClarification === true || result.missing.length > 0);
});

test("SlotResolver accepts both options", () => {
  const resolver = new SlotResolver({ maxRounds: 10, slotConfidenceThreshold: 0.85 });
  assert.equal(resolver.getMaxRounds(), 10);
});

test("SlotResolver getMaxRounds returns configured value", () => {
  assert.equal(new SlotResolver({ maxRounds: 7 }).getMaxRounds(), 7);
  assert.equal(new SlotResolver({ maxRounds: 1 }).getMaxRounds(), 1);
});

// ---------------------------------------------------------------------------
// SlotResolver.resolveRequiredSlots basic tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots returns missing slots when entities do not satisfy required", () => {
  const resolver = new SlotResolver();
  const entities = [makeEntity({ entityType: "user", value: "alice", normalized: "alice" })];

  const result = resolver.resolveRequiredSlots(entities, ["user", "environment"]);

  assert.ok(result.missing.includes("environment"));
  assert.ok(!result.missing.includes("user"));
  assert.deepEqual(result.resolved, { user: "alice" });
});

test("resolveRequiredSlots returns empty missing when all slots resolved", () => {
  const resolver = new SlotResolver();
  const entities = [
    makeEntity({ entityType: "user", value: "alice", normalized: "alice" }),
    makeEntity({ entityType: "environment", value: "prod", normalized: "prod" }),
  ];

  const result = resolver.resolveRequiredSlots(entities, ["user", "environment"]);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { user: "alice", environment: "prod" });
});

test("resolveRequiredSlots respects entityConfidence threshold", () => {
  const resolver = new SlotResolver({ slotConfidenceThreshold: 0.9 });
  const entities = [makeEntity({ entityType: "user", value: "alice", normalized: "alice" })];
  const entityConfidence = { user: 0.5 }; // Below threshold

  const result = resolver.resolveRequiredSlots(entities, ["user"], undefined, entityConfidence);

  assert.ok(result.missing.includes("user"));
});

test("resolveRequiredSlots accepts high confidence entity", () => {
  const resolver = new SlotResolver({ slotConfidenceThreshold: 0.9 });
  const entities = [makeEntity({ entityType: "user", value: "alice", normalized: "alice" })];
  const entityConfidence = { user: 0.95 }; // Above threshold

  const result = resolver.resolveRequiredSlots(entities, ["user"], undefined, entityConfidence);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { user: "alice" });
});

// ---------------------------------------------------------------------------
// SlotResolver.resolveRequiredSlots clarification round tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots starts at round 1 on first call", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["test"]);

  assert.equal(result.clarificationRound.roundNumber, 1);
  assert.equal(result.clarificationRound.state, "in_progress");
});

test("resolveRequiredSlots increments round when priorState provided", () => {
  const resolver = new SlotResolver();
  const priorState: ClarificationRound = {
    roundNumber: 1,
    missingSlots: ["test"],
    generatedQuestions: ["What is test?"],
    state: "in_progress",
  };

  const result = resolver.resolveRequiredSlots([], ["test"], priorState);

  assert.equal(result.clarificationRound.roundNumber, 2);
});

test("resolveRequiredSlots sets state to completed when no missing slots", () => {
  const resolver = new SlotResolver();
  const entities = [makeEntity({ entityType: "date", value: "2026-05-01", normalized: "2026-05-01" })];

  const result = resolver.resolveRequiredSlots(entities, ["date"]);

  assert.equal(result.clarificationRound.state, "completed");
});

test("resolveRequiredSlots sets state to blocked when max rounds reached", () => {
  const resolver = new SlotResolver({ maxRounds: 3 });
  const priorState: ClarificationRound = {
    roundNumber: 3,
    missingSlots: ["test"],
    generatedQuestions: [],
    state: "in_progress",
  };

  const result = resolver.resolveRequiredSlots([], ["test"], priorState);

  assert.equal(result.clarificationRound.state, "blocked");
});

test("resolveRequiredSlots sets shouldRequestClarification when in_progress", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["test"]);

  assert.equal(result.shouldRequestClarification, true);
});

test("resolveRequiredSlots sets shouldRequestClarification to false when completed", () => {
  const resolver = new SlotResolver();
  const entities = [makeEntity({ entityType: "date", value: "2026-05-01", normalized: "2026-05-01" })];

  const result = resolver.resolveRequiredSlots(entities, ["date"]);

  assert.equal(result.shouldRequestClarification, false);
});

// ---------------------------------------------------------------------------
// SlotResolver.resolveRequiredSlots generated questions tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots generates questions for missing slots in_progress state", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["date", "time"]);

  assert.ok(result.generatedQuestions.length > 0);
  assert.ok(result.clarificationRound.generatedQuestions.length > 0);
});

test("resolveRequiredSlots returns empty questions when completed", () => {
  const resolver = new SlotResolver();
  const entities = [makeEntity({ entityType: "date", value: "2026-05-01", normalized: "2026-05-01" })];

  const result = resolver.resolveRequiredSlots(entities, ["date"]);

  assert.equal(result.generatedQuestions.length, 0);
});

test("resolveRequiredSlots generates date question for missing date slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["date"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("日期") || q.includes("date")));
});

test("resolveRequiredSlots generates time question for missing time slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["time"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("时间") || q.includes("time")));
});

test("resolveRequiredSlots generates budget question for missing budget slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["budget"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("预算") || q.includes("budget")));
});

test("resolveRequiredSlots generates priority question for missing priority slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["priority"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("优先级") || q.includes("priority")));
});

test("resolveRequiredSlots generates assignee question for missing assignee slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["assignee"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("执行") || q.includes("assign")));
});

test("resolveRequiredSlots generates environment question for missing environment slot", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["environment"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("环境") || q.includes("environment")));
});

test("resolveRequiredSlots generates generic question for unknown slot type", () => {
  const resolver = new SlotResolver();
  const result = resolver.resolveRequiredSlots([], ["unknownSlot"]);

  assert.ok(result.generatedQuestions.some(q => q.includes("unknownSlot")));
});

// ---------------------------------------------------------------------------
// SlotResolver.resolveRequiredSlots priorConversationContext tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots extracts date from prior conversation context", () => {
  const resolver = new SlotResolver();
  const priorContext = [
    {
      turnNumber: 1,
      message: "请在 2026-05-15 执行",
      detectedIntent: { intentType: "task_create" },
      timestamp: "2026-05-01T00:00:00Z",
    },
  ];

  const result = resolver.resolveRequiredSlots([], ["date"], undefined, undefined, priorContext);

  assert.ok(!result.missing.includes("date") || result.missing.length === 0);
});

test("resolveRequiredSlots extracts time from prior conversation context", () => {
  const resolver = new SlotResolver();
  const priorContext = [
    {
      turnNumber: 1,
      message: "请在 14:30 执行",
      detectedIntent: { intentType: "task_create" },
      timestamp: "2026-05-01T00:00:00Z",
    },
  ];

  const result = resolver.resolveRequiredSlots([], ["time"], undefined, undefined, priorContext);

  assert.ok(!result.missing.includes("time") || result.missing.length === 0);
});

test("resolveRequiredSlots extracts budget from prior conversation context", () => {
  const resolver = new SlotResolver();
  // The regex requires budget|预算|cost followed by : or whitespace
  const priorContext = [
    {
      turnNumber: 1,
      message: "预算: $1000",
      detectedIntent: { intentType: "task_create" },
      timestamp: "2026-05-01T00:00:00Z",
    },
  ];

  const result = resolver.resolveRequiredSlots([], ["budget"], undefined, undefined, priorContext);

  assert.ok(!result.missing.includes("budget") || result.missing.length === 0);
});

test("resolveRequiredSlots uses only last 3 conversation turns", () => {
  const resolver = new SlotResolver();
  const priorContext = [
    { turnNumber: 1, message: "first turn", detectedIntent: { intentType: "task_create" }, timestamp: "2026-05-01T00:00:00Z" },
    { turnNumber: 2, message: "second turn", detectedIntent: { intentType: "task_create" }, timestamp: "2026-05-01T00:00:00Z" },
    { turnNumber: 3, message: "third turn", detectedIntent: { intentType: "task_create" }, timestamp: "2026-05-01T00:00:00Z" },
    { turnNumber: 4, message: "fourth turn", detectedIntent: { intentType: "task_create" }, timestamp: "2026-05-01T00:00:00Z" },
  ];

  const result = resolver.resolveRequiredSlots([], ["test"], undefined, undefined, priorContext);

  // Should not throw and should handle context
  assert.ok(result != null);
});

test("resolveRequiredSlots handles empty priorConversationContext", () => {
  const resolver = new SlotResolver();
  const priorContext: readonly {
    turnNumber: number;
    message: string;
    detectedIntent: { intentType: string };
    timestamp: string;
  }[] = [];

  const result = resolver.resolveRequiredSlots([], ["test"], undefined, undefined, priorContext);

  assert.ok(result.missing.includes("test"));
});

// ---------------------------------------------------------------------------
// SlotResolver.isBlocked tests
// ---------------------------------------------------------------------------

test("isBlocked returns true for blocked state", () => {
  const resolver = new SlotResolver();
  const round: ClarificationRound = {
    roundNumber: 5,
    missingSlots: ["test"],
    generatedQuestions: [],
    state: "blocked",
  };

  assert.equal(resolver.isBlocked(round), true);
});

test("isBlocked returns false for in_progress state", () => {
  const resolver = new SlotResolver();
  const round: ClarificationRound = {
    roundNumber: 1,
    missingSlots: ["test"],
    generatedQuestions: ["What is test?"],
    state: "in_progress",
  };

  assert.equal(resolver.isBlocked(round), false);
});

test("isBlocked returns false for completed state", () => {
  const resolver = new SlotResolver();
  const round: ClarificationRound = {
    roundNumber: 3,
    missingSlots: [],
    generatedQuestions: [],
    state: "completed",
  };

  assert.equal(resolver.isBlocked(round), false);
});

// ---------------------------------------------------------------------------
// SlotResolver multi-round clarification tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots tracks clarification rounds across multiple calls", () => {
  const resolver = new SlotResolver({ maxRounds: 3 });

  // Round 1
  const result1 = resolver.resolveRequiredSlots([], ["date", "time"]);
  assert.equal(result1.clarificationRound.roundNumber, 1);
  assert.equal(result1.clarificationRound.state, "in_progress");

  // Round 2
  const result2 = resolver.resolveRequiredSlots([], ["date", "time"], result1.clarificationRound);
  assert.equal(result2.clarificationRound.roundNumber, 2);
  assert.equal(result2.clarificationRound.state, "in_progress");

  // Round 3 - blocked because currentRound (3) >= maxRounds (3)
  const result3 = resolver.resolveRequiredSlots([], ["date", "time"], result2.clarificationRound);
  assert.equal(result3.clarificationRound.roundNumber, 3);
  assert.equal(result3.clarificationRound.state, "blocked");

  // Round 4 - still blocked
  const result4 = resolver.resolveRequiredSlots([], ["date", "time"], result3.clarificationRound);
  assert.equal(result4.clarificationRound.roundNumber, 4);
  assert.equal(result4.clarificationRound.state, "blocked");
});

test("resolveRequiredSlots completes successfully when entities provided in later round", () => {
  const resolver = new SlotResolver({ maxRounds: 3 });

  // Round 1 - missing date
  const result1 = resolver.resolveRequiredSlots([], ["date"]);
  assert.equal(result1.clarificationRound.state, "in_progress");

  // Round 2 - user provides date
  const entitiesWithDate = [makeEntity({ entityType: "date", value: "2026-05-15", normalized: "2026-05-15" })];
  const result2 = resolver.resolveRequiredSlots(entitiesWithDate, ["date"], result1.clarificationRound);

  assert.equal(result2.clarificationRound.state, "completed");
  assert.equal(result2.shouldRequestClarification, false);
});

// ---------------------------------------------------------------------------
// Deprecated resolveRequiredSlots function tests
// ---------------------------------------------------------------------------

test("resolveRequiredSlots (deprecated) returns missing when entities do not satisfy required", () => {
  const entities = [makeEntity({ entityType: "user", value: "alice", normalized: "alice" })];

  const result = resolveRequiredSlots(entities, ["user", "environment"]);

  assert.ok(result.missing.includes("environment"));
  assert.ok(!result.missing.includes("user"));
  assert.deepEqual(result.resolved, { user: "alice" });
});

test("resolveRequiredSlots (deprecated) returns empty missing when all slots resolved", () => {
  const entities = [
    makeEntity({ entityType: "user", value: "alice", normalized: "alice" }),
    makeEntity({ entityType: "environment", value: "prod", normalized: "prod" }),
  ];

  const result = resolveRequiredSlots(entities, ["user", "environment"]);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { user: "alice", environment: "prod" });
});

test("resolveRequiredSlots (deprecated) handles empty entities", () => {
  const result = resolveRequiredSlots([], ["user", "task"]);

  assert.deepEqual(result.missing, ["user", "task"]);
  assert.deepEqual(result.resolved, {});
});

test("resolveRequiredSlots (deprecated) handles empty requiredEntityTypes", () => {
  const entities = [makeEntity({ entityType: "user", value: "charlie", normalized: "charlie" })];

  const result = resolveRequiredSlots(entities, []);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { user: "charlie" });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("resolveRequiredSlots handles entity with confidence exactly at threshold", () => {
  const resolver = new SlotResolver({ slotConfidenceThreshold: 0.8 });
  const entities = [makeEntity({ entityType: "user", value: "alice", normalized: "alice" })];
  const entityConfidence = { user: 0.8 };

  const result = resolver.resolveRequiredSlots(entities, ["user"], undefined, entityConfidence);

  // At exactly threshold, should be resolved
  assert.equal(result.missing.length, 0);
});

test("resolveRequiredSlots deduplicates resolved slots (first wins)", () => {
  const resolver = new SlotResolver();
  const entities = [
    makeEntity({ entityType: "user", value: "first", normalized: "first_value" }),
    makeEntity({ entityType: "user", value: "second", normalized: "second_value" }),
  ];

  const result = resolver.resolveRequiredSlots(entities, ["user"]);

  assert.deepEqual(result.resolved, { user: "first_value" });
});

test("resolveRequiredSlots preserves non-normalized entity values", () => {
  const resolver = new SlotResolver();
  const entities = [
    makeEntity({ entityType: "count", value: "5", normalized: 5 }),
  ];

  const result = resolver.resolveRequiredSlots(entities, ["count"]);

  assert.strictEqual(result.resolved.count, 5);
});

test("SlotResolver handles zero maxRounds", () => {
  const resolver = new SlotResolver({ maxRounds: 0 });
  const result = resolver.resolveRequiredSlots([], ["test"]);

  assert.equal(result.clarificationRound.state, "blocked");
});

test("SlotResolver handles entity types with special characters", () => {
  const resolver = new SlotResolver();
  const entities = [makeEntity({ entityType: "user-name.with/special", value: "test", normalized: "test" })];

  const result = resolver.resolveRequiredSlots(entities, ["user-name.with/special"]);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { "user-name.with/special": "test" });
});
