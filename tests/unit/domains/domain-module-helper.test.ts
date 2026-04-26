import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { resolve } from "path";

// Use resolve to find the module properly
const srcPath = resolve(fileURLToPath(import.meta.url), "../../../../src/domains/domain-module-helper.js");

// Import using the resolved path
const mod = await import(srcPath);

test("createDomainModulePreset creates preset with correct domainId", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    ["code_review", "refactor"],
    ["security_scan"],
  );

  assert.equal(preset.domainId, "coding");
});

test("createDomainModulePreset includes displayName from baseline", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    ["code_review"],
    [],
  );

  assert.ok(preset.displayName.length > 0);
});

test("createDomainModulePreset includes default workflow IDs from baseline", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    [],
    [],
  );

  assert.ok(Array.isArray(preset.defaultWorkflowIds));
});

test("createDomainModulePreset includes default tool bundle IDs from baseline", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    [],
    [],
  );

  assert.ok(Array.isArray(preset.defaultToolBundleIds));
});

test("createDomainModulePreset includes required capabilities", () => {
  const taskTypes = ["code_review", "refactor", "testing"] as const;

  const preset = mod.createDomainModulePreset(
    "coding",
    taskTypes,
    [],
  );

  assert.deepEqual(preset.requiredCapabilities, taskTypes);
});

test("createDomainModulePreset includes review required task types", () => {
  const reviewTypes = ["security_scan", "compliance_check"] as const;

  const preset = mod.createDomainModulePreset(
    "coding",
    [],
    reviewTypes,
  );

  assert.deepEqual(preset.reviewRequiredTaskTypes, reviewTypes);
});

test("createDomainModulePreset returns frozen object", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    [],
    [],
  );

  assert.ok(Object.isFrozen(preset));
  assert.ok(Object.isFrozen(preset.requiredCapabilities));
  assert.ok(Object.isFrozen(preset.reviewRequiredTaskTypes));
});

test("requiresPresetReview returns true for review-required task type", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    ["code_review"],
    ["security_scan"],
  );

  assert.equal(mod.requiresPresetReview(preset, "security_scan"), true);
});

test("requiresPresetReview returns false for non-review-required task type", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    ["code_review", "refactor"],
    ["security_scan"],
  );

  assert.equal(mod.requiresPresetReview(preset, "code_review"), false);
  assert.equal(mod.requiresPresetReview(preset, "refactor"), false);
});

test("createDomainModulePreset with empty arrays", () => {
  const preset = mod.createDomainModulePreset(
    "coding",
    [],
    [],
  );

  assert.deepEqual(preset.requiredCapabilities, []);
  assert.deepEqual(preset.reviewRequiredTaskTypes, []);
});
