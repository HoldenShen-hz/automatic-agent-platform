import assert from "node:assert/strict";
import test from "node:test";

import {
  createStrategyVersion,
  type StrategyVersion,
  type StrategyReleaseLevel,
} from "../../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "test-" + Math.random().toString(36).slice(2),
    learningType: "failure_pattern",
    title: "Test learning object",
    summary: "Test summary",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Test recommendation",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("createStrategyVersion creates version with correct structure", () => {
  const learningObjects = [makeLearningObject({ learningObjectId: "lo-1" })];
  const version = createStrategyVersion("Test Strategy", learningObjects, "suggest");

  assert.equal(version.title, "Test Strategy");
  assert.equal(version.releaseLevel, "suggest");
  assert.deepEqual(version.sourceLearningObjectIds, ["lo-1"]);
  assert.ok(typeof version.strategyVersionId === "string");
  assert.ok(typeof version.createdAt === "number");
});

test("createStrategyVersion uses default releaseLevel of suggest", () => {
  const version = createStrategyVersion("Test", []);

  assert.equal(version.releaseLevel, "suggest");
});

test("createStrategyVersion accepts all release levels", () => {
  const levels: StrategyReleaseLevel[] = ["off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"];

  for (const level of levels) {
    const version = createStrategyVersion(`Strategy ${level}`, [], level);
    assert.equal(version.releaseLevel, level, `Failed for level ${level}`);
  }
});

test("createStrategyVersion generates unique version IDs", () => {
  const version1 = createStrategyVersion("Strategy 1", []);
  const version2 = createStrategyVersion("Strategy 2", []);

  assert.notEqual(version1.strategyVersionId, version2.strategyVersionId);
});

test("createStrategyVersion maps multiple learning objects correctly", () => {
  const learningObjects = [
    makeLearningObject({ learningObjectId: "lo-1" }),
    makeLearningObject({ learningObjectId: "lo-2" }),
    makeLearningObject({ learningObjectId: "lo-3" }),
  ];
  const version = createStrategyVersion("Multi-LO Strategy", learningObjects);

  assert.equal(version.sourceLearningObjectIds.length, 3);
  assert.ok(version.sourceLearningObjectIds.includes("lo-1"));
  assert.ok(version.sourceLearningObjectIds.includes("lo-2"));
  assert.ok(version.sourceLearningObjectIds.includes("lo-3"));
});

test("createStrategyVersion handles empty learning objects array", () => {
  const version = createStrategyVersion("Empty Strategy", []);

  assert.equal(version.sourceLearningObjectIds.length, 0);
});

test("StrategyVersion type accepts valid release levels", () => {
  const version: StrategyVersion = {
    strategyVersionId: "sv-1",
    title: "Typed Strategy",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "stable",
    createdAt: Date.now(),
  };

  assert.equal(version.releaseLevel, "stable");
});

test("StrategyReleaseLevel type includes all expected levels", () => {
  const levels: StrategyReleaseLevel[] = ["off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"];

  for (const level of levels) {
    const version: StrategyVersion = {
      strategyVersionId: `sv-${level}`,
      title: `Strategy ${level}`,
      sourceLearningObjectIds: [],
      releaseLevel: level,
      createdAt: Date.now(),
    };
    assert.equal(version.releaseLevel, level);
  }
});
