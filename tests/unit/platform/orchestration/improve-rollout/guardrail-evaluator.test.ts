import assert from "node:assert/strict";
import test from "node:test";

import { GuardrailEvaluator } from "../../../../../src/platform/orchestration/improve-rollout/guardrail-evaluator.js";
import type { ImprovementCandidate } from "../../../../../src/platform/orchestration/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../src/platform/orchestration/improve-rollout/strategy-versioning.js";

function createMockLearningObject(overrides = {}) {
  return {
    learningObjectId: "lo-1",
    evidenceRefs: ["evidence-1"],
    promotionStatus: "validated",
    ...overrides,
  };
}

function createMockCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    changeScope: "policy",
    description: "Test improvement",
    expectedBenefit: "Test benefit",
    status: "approved",
    createdAt: Date.now(),
    ...overrides,
  };
}

function createMockStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "strategy-v1",
    title: "Test Strategy",
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "shadow",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("GuardrailEvaluator evaluate returns allowed=true when all guardrails pass", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion();

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCodes.length, 0);
});

test("GuardrailEvaluator evaluate blocks when candidate has no signal refs", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ sourceSignalRefs: [] });
  const strategy = createMockStrategyVersion();

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
});

test("GuardrailEvaluator evaluate blocks when candidate has no learning objects", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ sourceLearningObjectIds: [] });
  const strategy = createMockStrategyVersion();

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
});

test("GuardrailEvaluator evaluate blocks when strategy has no learning objects", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion({ sourceLearningObjectIds: [] });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
});

test("GuardrailEvaluator evaluate blocks shadow release without approval", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "proposed" });
  const strategy = createMockStrategyVersion({ releaseLevel: "shadow" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_shadow_requires_approval"));
});

test("GuardrailEvaluator evaluate allows shadow with approved status", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "approved" });
  const strategy = createMockStrategyVersion({ releaseLevel: "shadow" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate allows shadow with shadow_running status", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "shadow_running" });
  const strategy = createMockStrategyVersion({ releaseLevel: "shadow" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate allows non-shadow release with proposed status", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "proposed" });
  const strategy = createMockStrategyVersion({ releaseLevel: "canary_5" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate collects multiple violations", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({
    sourceSignalRefs: [],
    sourceLearningObjectIds: [],
  });
  const strategy = createMockStrategyVersion({ sourceLearningObjectIds: [] });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
  assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
  assert.equal(result.reasonCodes.length, 3);
});

test("GuardrailEvaluator evaluate handles multiple candidate signal refs", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({
    sourceSignalRefs: ["signal-1", "signal-2", "signal-3"],
  });

  const result = evaluator.evaluate(candidate, createMockStrategyVersion());

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate handles stable release level", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "approved" });
  const strategy = createMockStrategyVersion({ releaseLevel: "stable" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate blocks shadow for rejected candidate", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate({ status: "rejected" });
  const strategy = createMockStrategyVersion({ releaseLevel: "shadow" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_shadow_requires_approval"));
});

test("GuardrailEvaluator evaluate handles partial_25 release level", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion({ releaseLevel: "partial_25" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate handles suggest release level", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion({ releaseLevel: "suggest" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate handles off release level", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion({ releaseLevel: "off" });

  const result = evaluator.evaluate(candidate, strategy);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator evaluate returns empty reasonCodes on success", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = createMockCandidate();
  const strategy = createMockStrategyVersion();

  const result = evaluator.evaluate(candidate, strategy);

  assert.deepEqual(result.reasonCodes, []);
});
