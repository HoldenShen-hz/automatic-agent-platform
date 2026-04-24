import assert from "node:assert/strict";
import test from "node:test";

import {
  createStrategyVersion,
  type StrategyVersion,
  type StrategyReleaseLevel,
} from "../../../../../src/platform/orchestration/improve-rollout/strategy-versioning.js";
import type { LearningObject } from "../../../../../src/platform/orchestration/learn/learning-object-model.js";

function createMockLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  const base: LearningObject = {
    learningObjectId: "lo-1",
    learningType: "failure_pattern",
    title: "Routing failure pattern",
    summary: "Captures repeated routing failures for policy improvement.",
    confidence: 0.92,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Tighten routing guardrails for this scenario.",
    validatedBy: "evidence",
    promotionStatus: "validated",
    createdAt: 1_710_000_000_000,
  };
  return {
    ...base,
    ...overrides,
  };
}

test("createStrategyVersion generates valid version with default release level", () => {
  const learningObjects = [createMockLearningObject()];
  const version = createStrategyVersion("Test Strategy", learningObjects);

  assert.ok(version.strategyVersionId.startsWith("strategy_version_"));
  assert.equal(version.title, "Test Strategy");
  assert.deepEqual(version.sourceLearningObjectIds, ["lo-1"]);
  assert.equal(version.releaseLevel, "suggest");
  assert.ok(version.createdAt > 0);
});

test("createStrategyVersion generates version with custom release level", () => {
  const learningObjects = [createMockLearningObject()];
  const version = createStrategyVersion("Shadow Strategy", learningObjects, "shadow");

  assert.equal(version.releaseLevel, "shadow");
});

test("createStrategyVersion maps learning objects correctly", () => {
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1" }),
    createMockLearningObject({ learningObjectId: "lo-2" }),
    createMockLearningObject({ learningObjectId: "lo-3" }),
  ];
  const version = createStrategyVersion("Multi-LO Strategy", learningObjects);

  assert.deepEqual(version.sourceLearningObjectIds, ["lo-1", "lo-2", "lo-3"]);
  assert.equal(version.sourceLearningObjectIds.length, 3);
});

test("createStrategyVersion handles empty learning objects array", () => {
  const version = createStrategyVersion("Empty Strategy", []);

  assert.deepEqual(version.sourceLearningObjectIds, []);
});

test("createStrategyVersion uses all release levels correctly", () => {
  const levels: StrategyReleaseLevel[] = [
    "off",
    "suggest",
    "shadow",
    "canary_5",
    "partial_25",
    "partial_50",
    "partial_75",
    "stable",
  ];

  for (const level of levels) {
    const version = createStrategyVersion(`Strategy ${level}`, [], level);
    assert.equal(version.releaseLevel, level, `Failed for level ${level}`);
  }
});

test("createStrategyVersion preserves evidence refs from learning objects", () => {
  const learningObjects = [
    createMockLearningObject({ learningObjectId: "lo-1", evidenceRefs: ["e1", "e2"] }),
    createMockLearningObject({ learningObjectId: "lo-2", evidenceRefs: ["e3"] }),
  ];
  const version = createStrategyVersion("Evidence Strategy", learningObjects);

  assert.deepEqual(version.sourceLearningObjectIds, ["lo-1", "lo-2"]);
});

test("StrategyVersion type accepts all release levels", () => {
  const version1: StrategyVersion = {
    strategyVersionId: "sv-1",
    title: "Test",
    sourceLearningObjectIds: [],
    releaseLevel: "off",
    createdAt: Date.now(),
  };
  const version2: StrategyVersion = { ...version1, releaseLevel: "stable" };
  const version3: StrategyVersion = { ...version1, releaseLevel: "canary_5" };

  assert.ok(version1);
  assert.ok(version2);
  assert.ok(version3);
});

test("createStrategyVersion generates unique IDs for multiple calls", () => {
  const version1 = createStrategyVersion("Strategy 1", []);
  const version2 = createStrategyVersion("Strategy 2", []);
  const version3 = createStrategyVersion("Strategy 3", []);

  assert.notEqual(version1.strategyVersionId, version2.strategyVersionId);
  assert.notEqual(version2.strategyVersionId, version3.strategyVersionId);
  assert.notEqual(version1.strategyVersionId, version3.strategyVersionId);
});

test("createStrategyVersion createdAt is current timestamp", () => {
  const before = Date.now();
  const version = createStrategyVersion("Timing Test", []);
  const after = Date.now();

  assert.ok(version.createdAt >= before);
  assert.ok(version.createdAt <= after);
});

test("createStrategyVersion with single learning object", () => {
  const learningObjects = [createMockLearningObject()];
  const version = createStrategyVersion("Single LO", learningObjects);

  assert.deepEqual(version.sourceLearningObjectIds, ["lo-1"]);
  assert.equal(version.sourceLearningObjectIds.length, 1);
});

test("createStrategyVersion default release level is suggest", () => {
  const version = createStrategyVersion("Default Test", []);

  assert.equal(version.releaseLevel, "suggest");
});

test("StrategyReleaseLevel type is union of allowed values", () => {
  const level: StrategyReleaseLevel = "canary_5";
  assert.equal(level, "canary_5");

  const level2: StrategyReleaseLevel = "stable";
  assert.equal(level2, "stable");
});
