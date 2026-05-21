/**
 * Unit tests for slot-resolver module
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveRequiredSlots,
  buildSlotClarificationState,
  refineSlotResolution,
  type SlotClarificationState,
} from "../../../../../src/interaction/nl-gateway/slot-resolver/index.js";

function createEntity(entityType: string, value: string, normalized = value): { entityType: string; value: string; normalized: string } {
  return { entityType, value, normalized };
}

test("resolveRequiredSlots returns empty missing when all entities present", () => {
  const entities = [
    createEntity("date", "2024-01-01"),
    createEntity("environment", "prod"),
  ];
  const required = ["date", "environment"] as const;

  const result = resolveRequiredSlots(entities, required);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { date: "2024-01-01", environment: "prod" });
});

test("resolveRequiredSlots returns missing entity types when not present", () => {
  const entities = [createEntity("date", "2024-01-01")];
  const required = ["date", "environment", "channel"] as const;

  const result = resolveRequiredSlots(entities, required);

  assert.deepEqual(result.missing, ["environment", "channel"]);
  assert.deepEqual(result.resolved, { date: "2024-01-01" });
});

test("resolveRequiredSlots handles empty entity list", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["date", "environment"] as const;

  const result = resolveRequiredSlots(entities, required);

  assert.deepEqual(result.missing, ["date", "environment"]);
  assert.deepEqual(result.resolved, {});
});

test("resolveRequiredSlots handles empty required list", () => {
  const entities = [createEntity("date", "2024-01-01")];
  const required: readonly string[] = [];

  const result = resolveRequiredSlots(entities, required);

  assert.equal(result.missing.length, 0);
  assert.deepEqual(result.resolved, { date: "2024-01-01" });
});

test("resolveRequiredSlots only keeps first entity per type", () => {
  const entities = [
    createEntity("date", "2024-01-01"),
    createEntity("date", "2024-01-02"),
  ];
  const required = ["date"] as const;

  const result = resolveRequiredSlots(entities, required);

  assert.equal(result.missing.length, 0);
  assert.equal(result.resolved["date"], "2024-01-01");
});

test("resolveRequiredSlots returns missing slots without deduplication when required has duplicates", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["date", "date", "environment"] as const;

  const result = resolveRequiredSlots(entities, required);

  // Note: resolveRequiredSlots does NOT deduplicate - missing includes duplicates from required
  assert.deepEqual(result.missing, ["date", "date", "environment"]);
});

test("buildSlotClarificationState returns correct initial state", () => {
  const entities = [createEntity("date", "2024-01-01")];
  const required = ["date", "environment"] as const;

  const result = buildSlotClarificationState(entities, required);

  assert.deepEqual(result.missing, ["environment"]);
  assert.deepEqual(result.resolved, { date: "2024-01-01" });
  assert.ok(result.questions.includes("请确认目标环境，例如 dev、staging 或 production。"));
  assert.equal(result.attempt, 1);
  assert.equal(result.isComplete, false);
  assert.equal(result.escalationRequired, false);
  assert.equal(result.nextExpectedSlot, "environment");
});

test("buildSlotClarificationState with all slots resolved", () => {
  const entities = [
    createEntity("date", "2024-01-01"),
    createEntity("environment", "prod"),
  ];
  const required = ["date", "environment"] as const;

  const result = buildSlotClarificationState(entities, required);

  assert.equal(result.missing.length, 0);
  assert.equal(result.isComplete, true);
  assert.equal(result.questions.length, 0);
  assert.equal(result.nextExpectedSlot, null);
});

test("buildSlotClarificationState uses previousResolved as base", () => {
  const entities = [createEntity("environment", "prod")];
  const required = ["date", "environment", "channel"] as const;
  const options = {
    previousResolved: { date: "2024-01-01", channel: "slack" },
  };

  const result = buildSlotClarificationState(entities, required, options);

  assert.equal(result.missing.length, 0);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.resolved, { date: "2024-01-01", channel: "slack", environment: "prod" });
});

test("buildSlotClarificationState uses custom prompts per slot", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["date", "environment"] as const;
  const options = {
    promptBySlot: {
      date: "请选择日期：",
      environment: "选择环境：",
    },
  };

  const result = buildSlotClarificationState(entities, required, options);

  assert.deepEqual(result.questions, ["请选择日期：", "选择环境："]);
});

test("buildSlotClarificationState respects maxRounds option", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["date"] as const;
  const options = { maxRounds: 5 };

  const result = buildSlotClarificationState(entities, required, options);

  // Max rounds is stored but only used during refinement
  assert.equal(result.attempt, 1);
});

test("buildSlotClarificationState uses default prompts for unknown slots", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["unknownSlot"] as const;

  const result = buildSlotClarificationState(entities, required);

  assert.ok(result.questions[0].includes("unknownSlot"));
});

test("refineSlotResolution returns same state when already complete", () => {
  const currentState: SlotClarificationState = {
    missing: [],
    resolved: { date: "2024-01-01" },
    questions: [],
    attempt: 1,
    isComplete: true,
    escalationRequired: false,
    nextExpectedSlot: null,
  };

  const result = refineSlotResolution(currentState, []);

  assert.deepEqual(result, currentState);
});

test("refineSlotResolution merges new entities with resolved", () => {
  const currentState: SlotClarificationState = {
    missing: ["date", "environment"],
    resolved: {},
    questions: [],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities = [createEntity("date", "2024-01-01")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.deepEqual(result.missing, ["environment"]);
  assert.deepEqual(result.resolved, { date: "2024-01-01" });
  assert.equal(result.attempt, 2);
  assert.equal(result.nextExpectedSlot, "environment");
});

test("refineSlotResolution completes when all slots filled", () => {
  const currentState: SlotClarificationState = {
    missing: ["date"],
    resolved: {},
    questions: ["请提供日期"],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities = [createEntity("date", "2024-01-01")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.equal(result.missing.length, 0);
  assert.equal(result.isComplete, true);
  assert.equal(result.questions.length, 0);
  assert.equal(result.nextExpectedSlot, null);
});

test("refineSlotResolution does not overwrite existing resolved slots", () => {
  const currentState: SlotClarificationState = {
    missing: ["date"],
    resolved: { date: "2024-01-01" },
    questions: [],
    attempt: 1,
    isComplete: true,
    escalationRequired: false,
    nextExpectedSlot: null,
  };
  const newEntities = [createEntity("date", "2024-02-01")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.equal(result.resolved["date"], "2024-01-01");
});

test("refineSlotResolution escalates when max rounds exceeded", () => {
  const currentState: SlotClarificationState = {
    missing: ["date", "environment"],
    resolved: {},
    questions: [],
    attempt: 3,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const options = { maxRounds: 3 };

  const result = refineSlotResolution(currentState, [], options);

  assert.equal(result.escalationRequired, true);
  assert.ok(result.questions[0].includes("已达到最大澄清轮次"));
  assert.equal(result.isComplete, false);
});

test("refineSlotResolution uses custom prompts in refinement", () => {
  const currentState: SlotClarificationState = {
    missing: ["environment"],
    resolved: {},
    questions: [],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "environment",
  };
  const newEntities: ReturnType<typeof createEntity>[] = [];
  const options = {
    promptBySlot: {
      environment: "请指定目标环境：",
    },
  };

  const result = refineSlotResolution(currentState, newEntities, options);

  assert.ok(result.questions[0].includes("请指定目标环境："));
});

test("refineSlotResolution deduplicates missing slots after refinement", () => {
  const currentState: SlotClarificationState = {
    missing: ["date", "date", "environment"],
    resolved: {},
    questions: [],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities = [createEntity("date", "2024-01-01")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.deepEqual(result.missing, ["environment"]);
});

test("refineSlotResolution increments attempt counter", () => {
  const currentState: SlotClarificationState = {
    missing: ["date", "environment"],
    resolved: {},
    questions: [],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities = [createEntity("date", "2024-01-01")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.equal(result.attempt, 2);
});

test("refineSlotResolution caps attempt at maxRounds", () => {
  const currentState: SlotClarificationState = {
    missing: ["date", "environment"],
    resolved: {},
    questions: [],
    attempt: 2,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities = [createEntity("date", "2024-01-01")];
  const options = { maxRounds: 3 };

  const result = refineSlotResolution(currentState, newEntities, options);

  assert.equal(result.attempt, 3);
});

test("buildSlotClarificationState with empty entities array", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["date", "environment"] as const;

  const result = buildSlotClarificationState(entities, required);

  assert.deepEqual(result.missing, ["date", "environment"]);
  assert.deepEqual(result.resolved, {});
  assert.equal(result.questions.length, 2);
});

test("refineSlotResolution handles empty newEntities array", () => {
  const currentState: SlotClarificationState = {
    missing: ["date"],
    resolved: {},
    questions: ["请提供日期"],
    attempt: 1,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "date",
  };
  const newEntities: ReturnType<typeof createEntity>[] = [];

  const result = refineSlotResolution(currentState, newEntities);

  assert.deepEqual(result.missing, ["date"]);
  assert.equal(result.attempt, 2);
});

test("buildSlotClarificationState sets nextExpectedSlot to first missing slot", () => {
  const entities: ReturnType<typeof createEntity>[] = [];
  const required = ["channel", "date", "environment"] as const;

  const result = buildSlotClarificationState(entities, required);

  assert.equal(result.nextExpectedSlot, "channel");
});

test("refineSlotResolution preserves existing resolved slots from current state", () => {
  const currentState: SlotClarificationState = {
    missing: ["environment"],
    resolved: { date: "2024-01-01", channel: "slack" },
    questions: [],
    attempt: 2,
    isComplete: false,
    escalationRequired: false,
    nextExpectedSlot: "environment",
  };
  const newEntities = [createEntity("environment", "prod")];

  const result = refineSlotResolution(currentState, newEntities);

  assert.equal(result.resolved["date"], "2024-01-01");
  assert.equal(result.resolved["channel"], "slack");
  assert.equal(result.resolved["environment"], "prod");
});