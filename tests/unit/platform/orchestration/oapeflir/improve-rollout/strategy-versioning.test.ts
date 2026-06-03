import test from "node:test";
import assert from "node:assert/strict";

import { createStrategyVersion } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/improve-rollout/strategy-versioning.js";
import type { LearningObject } from "../../../../../../src/platform/five-plane-orchestration/oapeflir/learn/learning-object-model.js";

function createLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  const learningObjectId = overrides.learningObjectId ?? overrides.objectId ?? "lo_test";
  const learningType = overrides.learningType ?? overrides.kind ?? "failure_pattern";
  const title = overrides.title ?? "Test";
  const summary = overrides.summary ?? "Summary";
  const evidenceRefs = overrides.evidenceRefs ?? [];
  const sourceSignalIds = overrides.sourceSignalIds ?? [];
  const recommendation = overrides.recommendation ?? "Rec";

  return {
    learningObjectId,
    objectId: overrides.objectId ?? learningObjectId,
    learningType,
    kind: overrides.kind ?? learningType,
    title,
    summary,
    content: overrides.content ?? {
      title,
      summary,
      evidenceRefs,
      sourceSignalIds,
      recommendation,
    },
    confidence: overrides.confidence ?? 0.9,
    evidenceRefs,
    sourceSignalIds,
    recommendation,
    validatedBy: overrides.validatedBy ?? "evidence",
    promotionStatus: overrides.promotionStatus ?? "validated",
    status: overrides.status ?? "validated",
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    ...overrides,
  };
}

test("createStrategyVersion creates version with suggest level by default", () => {
  const result = createStrategyVersion("Test Strategy", []);
  assert.equal(result.title, "Test Strategy");
  assert.equal(result.releaseLevel, "suggest");
  assert.ok(result.strategyVersionId.startsWith("strategy_version_"));
  assert.deepEqual(result.sourceLearningObjectIds, []);
});

test("createStrategyVersion maps learning objects to IDs", () => {
  const learningObjects = [
    createLearningObject({ learningObjectId: "lo_1" }),
    createLearningObject({
      learningObjectId: "lo_2",
      learningType: "user_correction",
      kind: "user_correction",
      title: "Test2",
      summary: "Summary2",
      confidence: 0.8,
      recommendation: "Rec2",
    }),
  ];

  const result = createStrategyVersion("Test", learningObjects, "stable");
  assert.deepEqual(result.sourceLearningObjectIds, ["lo_1", "lo_2"]);
});

test("createStrategyVersion accepts all release levels", () => {
  const levels = ["off", "suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"] as const;
  for (const level of levels) {
    const result = createStrategyVersion("Test", [], level);
    assert.equal(result.releaseLevel, level);
  }
});

test("createStrategyVersion sets createdAt to current time", () => {
  const before = Date.now();
  const result = createStrategyVersion("Test", []);
  const after = Date.now();
  assert.ok(result.createdAt >= before);
  assert.ok(result.createdAt <= after);
});
