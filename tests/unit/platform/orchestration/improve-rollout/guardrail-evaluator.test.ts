import assert from "node:assert/strict";
import test from "node:test";

import { GuardrailEvaluator } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/guardrail-evaluator.js";
import type { ImprovementCandidate } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/improvement-candidate-registry.js";
import type { StrategyVersion } from "../../../../../src/platform/five-plane-orchestration/improve-rollout/strategy-versioning.js";

function makeCandidate(overrides: Partial<ImprovementCandidate> = {}): ImprovementCandidate {
  return {
    candidateId: "candidate-1",
    taskId: "task-1",
    sourceSignalRefs: ["signal-ref-1"],
    sourceLearningObjectIds: ["learning-object-1"],
    changeScope: "policy",
    description: "Test improvement candidate",
    expectedBenefit: "Test benefit",
    status: "proposed",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeStrategyVersion(overrides: Partial<StrategyVersion> = {}): StrategyVersion {
  return {
    strategyVersionId: "strategy-version-1",
    title: "Test Strategy",
    sourceLearningObjectIds: ["learning-object-1"],
    releaseLevel: "suggest",
    createdAt: Date.now(),
    ...overrides,
  };
}

test("GuardrailEvaluator returns allowed true when all checks pass", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    status: "approved",
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "suggest",
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, true);
  assert.equal(result.reasonCodes.length, 0);
});

test("GuardrailEvaluator returns not allowed when candidate has no sourceSignalRefs", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: [],
    sourceLearningObjectIds: ["lo-1"],
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
});

test("GuardrailEvaluator returns not allowed when candidate has no sourceLearningObjectIds", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: [],
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
});

test("GuardrailEvaluator returns not allowed when strategyVersion has no sourceLearningObjectIds", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: [],
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
});

test("GuardrailEvaluator returns not allowed when shadow release without approved candidate", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    status: "proposed",
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "shadow",
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_shadow_requires_approval"));
});

test("GuardrailEvaluator allows shadow release when candidate is approved", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    status: "approved",
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "shadow",
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator allows shadow release when candidate is shadow_running", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    status: "shadow_running",
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "shadow",
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, true);
});

test("GuardrailEvaluator returns multiple reason codes when multiple checks fail", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: [],
    sourceLearningObjectIds: [],
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: [],
  });

  const result = evaluator.evaluate(candidate, strategyVersion);

  assert.equal(result.allowed, false);
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_evidence"));
  assert.ok(result.reasonCodes.includes("improvement.guardrail_missing_learning_object"));
  assert.ok(result.reasonCodes.includes("improvement.guardrail_unlinked_strategy"));
});

test("GuardrailEvaluator evaluates with different release levels", () => {
  const evaluator = new GuardrailEvaluator();
  const candidate = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
    status: "approved",
  });

  const levels: StrategyVersion["releaseLevel"][] = ["suggest", "shadow", "canary_5", "partial_25", "partial_50", "partial_75", "stable"];

  for (const level of levels) {
    const strategyVersion = makeStrategyVersion({
      sourceLearningObjectIds: ["lo-1"],
      releaseLevel: level,
    });
    const result = evaluator.evaluate(candidate, strategyVersion);
    assert.equal(result.allowed, true, `Failed for level ${level}`);
  }
});

test("GuardrailEvaluator evaluates candidate with different statuses", () => {
  const evaluator = new GuardrailEvaluator();
  const statuses: ImprovementCandidate["status"][] = ["proposed", "evaluating", "approved", "shadow_running", "rejected", "rolled_back"];

  const candidateBase = makeCandidate({
    sourceSignalRefs: ["signal-1"],
    sourceLearningObjectIds: ["lo-1"],
  });
  const strategyVersion = makeStrategyVersion({
    sourceLearningObjectIds: ["lo-1"],
    releaseLevel: "suggest",
  });

  for (const status of statuses) {
    const candidate = { ...candidateBase, status };
    const result = evaluator.evaluate(candidate, strategyVersion);
    // Only shadow should fail without approved/shadow_running
    if (status === "approved" || status === "shadow_running") {
      assert.equal(result.allowed, true, `Failed for status ${status}`);
    }
  }
});
