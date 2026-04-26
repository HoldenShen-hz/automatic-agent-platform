import assert from "node:assert/strict";
import test from "node:test";

import {
  GameDevTaskTypeSchema,
  GAME_DEV_DOMAIN_PRESET,
  requiresGameDevReview,
  type GameDevTaskType,
} from "../../../../src/domains/game-dev/index.js";

test("GameDevTaskTypeSchema accepts valid task types", () => {
  assert.equal(GameDevTaskTypeSchema.parse("design"), "design");
  assert.equal(GameDevTaskTypeSchema.parse("build"), "build");
  assert.equal(GameDevTaskTypeSchema.parse("verify"), "verify");
});

test("GameDevTaskTypeSchema rejects invalid task types", () => {
  assert.throws(() => GameDevTaskTypeSchema.parse("invalid"));
});

test("GAME_DEV_DOMAIN_PRESET has correct domainId", () => {
  assert.equal(GAME_DEV_DOMAIN_PRESET.domainId, "game-dev");
});

test("GAME_DEV_DOMAIN_PRESET has correct displayName", () => {
  assert.equal(GAME_DEV_DOMAIN_PRESET.displayName, "Game Dev");
});

test("GAME_DEV_DOMAIN_PRESET has requiredCapabilities", () => {
  assert.deepEqual(GAME_DEV_DOMAIN_PRESET.requiredCapabilities, ["design", "build", "verify"]);
});

test("GAME_DEV_DOMAIN_PRESET has reviewRequiredTaskTypes", () => {
  assert.deepEqual(GAME_DEV_DOMAIN_PRESET.reviewRequiredTaskTypes, ["build", "verify"]);
});

test("GAME_DEV_DOMAIN_PRESET has defaultWorkflowIds", () => {
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(GAME_DEV_DOMAIN_PRESET.defaultWorkflowIds.length > 0);
});

test("GAME_DEV_DOMAIN_PRESET has defaultToolBundleIds", () => {
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(GAME_DEV_DOMAIN_PRESET.defaultToolBundleIds.length > 0);
});

test("requiresGameDevReview returns true for build task type", () => {
  assert.equal(requiresGameDevReview("build"), true);
});

test("requiresGameDevReview returns true for verify task type", () => {
  assert.equal(requiresGameDevReview("verify"), true);
});

test("requiresGameDevReview returns false for design task type", () => {
  assert.equal(requiresGameDevReview("design"), false);
});

test("GAME_DEV_DOMAIN_PRESET is frozen and immutable", () => {
  assert.ok(Object.isFrozen(GAME_DEV_DOMAIN_PRESET));
  assert.ok(Object.isFrozen(GAME_DEV_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Object.isFrozen(GAME_DEV_DOMAIN_PRESET.reviewRequiredTaskTypes));
});
