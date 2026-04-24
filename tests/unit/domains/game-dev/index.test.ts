import assert from "node:assert/strict";
import test from "node:test";

import {
  GameDevTaskTypeSchema,
  GAME_DEV_DOMAIN_PRESET,
  GameDevDomainPreset,
  requiresGameDevReview,
} from "../../../../src/domains/game-dev/index.js";

test("GameDevTaskTypeSchema accepts valid task types", () => {
  const types = ["design", "build", "verify"] as const;
  for (const type of types) {
    const result = GameDevTaskTypeSchema.safeParse(type);
    assert.equal(result.success, true, `Expected ${type} to be valid`);
  }
});

test("GameDevTaskTypeSchema rejects invalid task types", () => {
  const result = GameDevTaskTypeSchema.safeParse("invalid");
  assert.equal(result.success, false);
});

test("GAME_DEV_DOMAIN_PRESET has correct structure", () => {
  assert.equal(GAME_DEV_DOMAIN_PRESET.domainId, "game-dev");
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.defaultWorkflowIds));
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.defaultToolBundleIds));
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.requiredCapabilities));
  assert.ok(Array.isArray(GAME_DEV_DOMAIN_PRESET.reviewRequiredTaskTypes));
});

test("GAME_DEV_DOMAIN_PRESET has correct required capabilities", () => {
  assert.deepEqual(GAME_DEV_DOMAIN_PRESET.requiredCapabilities, ["design", "build", "verify"]);
});

test("GAME_DEV_DOMAIN_PRESET has correct review required task types", () => {
  assert.deepEqual(GAME_DEV_DOMAIN_PRESET.reviewRequiredTaskTypes, ["build", "verify"]);
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
