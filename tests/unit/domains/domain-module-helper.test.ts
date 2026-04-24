import assert from "node:assert/strict";
import test from "node:test";

import {
  createDomainModulePreset,
  requiresPresetReview,
  type DomainModulePreset,
} from "../../../src/domains/domain-module-helper.js";
import { getVerticalDomainBaseline } from "../../../src/domains/domain-baseline-catalog.js";

test("createDomainModulePreset returns DomainModulePreset with correct domainId", () => {
  const preset = createDomainModulePreset("coding", ["analyze", "implement"], ["test"]);

  assert.equal(preset.domainId, "coding");
});

test("createDomainModulePreset derives displayName from baseline", () => {
  const preset = createDomainModulePreset("coding", ["analyze", "implement"], ["test"]);

  assert.equal(preset.displayName, "Coding");
});

test("createDomainModulePreset includes task types and review requirements", () => {
  const taskTypes = ["analyze", "implement"] as const;
  const reviewTypes = ["test"] as const;
  const preset = createDomainModulePreset("coding", taskTypes, reviewTypes);

  assert.deepEqual(preset.requiredCapabilities, ["analyze", "implement"]);
  assert.deepEqual(preset.reviewRequiredTaskTypes, ["test"]);
});

test("createDomainModulePreset derives workflow ids from baseline definition", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], []);

  assert.ok(preset.defaultWorkflowIds.length > 0);
  assert.ok(preset.defaultWorkflowIds.every((id) => typeof id === "string"));
});

test("createDomainModulePreset derives tool bundle ids from baseline definition", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], []);

  assert.ok(preset.defaultToolBundleIds.length > 0);
  assert.ok(preset.defaultToolBundleIds.every((id) => typeof id === "string"));
});

test("createDomainModulePreset works for quant-trading domain", () => {
  const preset = createDomainModulePreset("quant-trading", ["research", "simulate"], ["trade"]);

  assert.equal(preset.domainId, "quant-trading");
  assert.equal(preset.displayName, "Quant Trading");
  assert.deepEqual(preset.requiredCapabilities, ["research", "simulate"]);
  assert.deepEqual(preset.reviewRequiredTaskTypes, ["trade"]);
});

test("createDomainModulePreset works for healthcare domain", () => {
  const preset = createDomainModulePreset("healthcare", ["triage", "summarize"], ["coordinate"]);

  assert.equal(preset.domainId, "healthcare");
  assert.ok(preset.defaultWorkflowIds.length > 0);
  assert.ok(preset.defaultToolBundleIds.length > 0);
});

test("requiresPresetReview returns true when task type requires review", () => {
  const preset: DomainModulePreset<string> = {
    domainId: "coding",
    displayName: "Coding",
    defaultWorkflowIds: ["coding.primary"],
    defaultToolBundleIds: ["coding.default"],
    requiredCapabilities: ["analyze", "implement"],
    reviewRequiredTaskTypes: ["test", "release"],
  };

  assert.equal(requiresPresetReview(preset, "test"), true);
  assert.equal(requiresPresetReview(preset, "release"), true);
});

test("requiresPresetReview returns false when task type does not require review", () => {
  const preset: DomainModulePreset<string> = {
    domainId: "coding",
    displayName: "Coding",
    defaultWorkflowIds: ["coding.primary"],
    defaultToolBundleIds: ["coding.default"],
    requiredCapabilities: ["analyze", "implement"],
    reviewRequiredTaskTypes: ["test"],
  };

  assert.equal(requiresPresetReview(preset, "analyze"), false);
  assert.equal(requiresPresetReview(preset, "implement"), false);
});

test("requiresPresetReview handles empty reviewRequiredTaskTypes", () => {
  const preset: DomainModulePreset<string> = {
    domainId: "data-engineering",
    displayName: "Data Engineering",
    defaultWorkflowIds: ["data-engineering.primary"],
    defaultToolBundleIds: ["data-engineering.default"],
    requiredCapabilities: ["ingest", "clean"],
    reviewRequiredTaskTypes: [],
  };

  assert.equal(requiresPresetReview(preset, "ingest"), false);
});

test("createDomainModulePreset preserves readonly nature of arrays", () => {
  const preset = createDomainModulePreset("coding", ["analyze"], ["test"]);

  assert.equal(Object.isFrozen(preset.requiredCapabilities), true);
  assert.equal(Object.isFrozen(preset.reviewRequiredTaskTypes), true);
  assert.equal(Object.isFrozen(preset.defaultWorkflowIds), true);
  assert.equal(Object.isFrozen(preset.defaultToolBundleIds), true);
});

test("createDomainModulePreset uses getVerticalDomainBaseline internally", () => {
  const codingBaseline = getVerticalDomainBaseline("coding");
  const preset = createDomainModulePreset("coding", ["analyze"], []);

  assert.equal(preset.domainId, codingBaseline.domainId);
  assert.equal(preset.displayName, codingBaseline.displayName);
});
