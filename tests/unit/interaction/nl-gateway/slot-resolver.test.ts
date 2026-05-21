import assert from "node:assert/strict";
import test from "node:test";

import { buildSlotClarificationState, resolveRequiredSlots } from "../../../../src/interaction/nl-gateway/slot-resolver/index.js";
import type { ExtractedEntity } from "../../../../src/interaction/nl-gateway/index.js";

function makeEntity(type: string, value: string, normalized?: unknown): ExtractedEntity {
  return {
    entityType: type,
    value,
    normalized: normalized ?? value,
    sourceSpan: [0, value.length],
  };
}

test("resolveRequiredSlots returns all as missing when no entities", () => {
  const result = resolveRequiredSlots([], ["date", "environment"]);

  assert.deepEqual(result.missing, ["date", "environment"]);
  assert.deepEqual(result.resolved, {});
});

test("resolveRequiredSlots resolves present entities", () => {
  const entities = [
    makeEntity("date", "2026-04-29"),
    makeEntity("environment", "prod"),
  ];
  const result = resolveRequiredSlots(entities, ["date", "environment"]);

  assert.deepEqual(result.missing, []);
  assert.equal(result.resolved["date"], "2026-04-29");
  assert.equal(result.resolved["environment"], "prod");
});

test("resolveRequiredSlots handles partial resolution", () => {
  const entities = [makeEntity("date", "2026-04-29")];
  const result = resolveRequiredSlots(entities, ["date", "environment", "channel"]);

  assert.deepEqual(result.missing, ["environment", "channel"]);
  assert.ok("date" in result.resolved);
});

test("resolveRequiredSlots uses normalized value", () => {
  const entities = [makeEntity("money", "¥500", 500)];
  const result = resolveRequiredSlots(entities, ["money"]);

  assert.equal(result.resolved["money"], 500);
});

test("resolveRequiredSlots deduplicates same entity type", () => {
  const entities = [
    makeEntity("date", "2026-04-29"),
    makeEntity("date", "2026-05-01"),
  ];
  const result = resolveRequiredSlots(entities, ["date"]);

  // First occurrence wins
  assert.equal(result.resolved["date"], "2026-04-29");
});

test("resolveRequiredSlots empty requiredEntityTypes", () => {
  const result = resolveRequiredSlots([makeEntity("date", "2026-04-29")], []);

  assert.deepEqual(result.missing, []);
  assert.ok("date" in result.resolved);
});

test("buildSlotClarificationState builds prompts for missing slots", () => {
  const result = buildSlotClarificationState([makeEntity("date", "2026-04-29")], ["date", "environment", "channel"]);

  assert.deepEqual(result.missing, ["environment", "channel"]);
  assert.equal(result.isComplete, false);
  assert.equal(result.nextExpectedSlot, "environment");
  assert.equal(result.questions.length, 2);
});
