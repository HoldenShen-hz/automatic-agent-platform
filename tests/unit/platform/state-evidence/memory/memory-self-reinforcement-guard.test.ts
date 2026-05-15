import assert from "node:assert/strict";
import test from "node:test";

import {
  MemorySelfReinforcementGuard,
  type MemoryPromotionEvidence,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-self-reinforcement-guard.js";

test("MemorySelfReinforcementGuard.evaluate returns promotable=true for ideal evidence", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_1",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: false,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, true);
  assert.deepEqual(decision.reasonCodes, []);
});

test("MemorySelfReinforcementGuard.evaluate flags self_generated_evaluator", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_2",
    evaluatorGeneratedByCandidate: true,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: false,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.self_generated_evaluator"));
});

test("MemorySelfReinforcementGuard.evaluate flags holdout_failed", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_3",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: false,
    differentJudgePassed: true,
    humanReviewRequired: false,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.holdout_failed"));
});

test("MemorySelfReinforcementGuard.evaluate flags different_judge_failed", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_4",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: true,
    differentJudgePassed: false,
    humanReviewRequired: false,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.different_judge_failed"));
});

test("MemorySelfReinforcementGuard.evaluate flags human_review_required when not approved", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_5",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: true,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.human_review_required"));
});

test("MemorySelfReinforcementGuard.evaluate allows promotable when human review passed", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_6",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: true,
    humanApproved: true,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, true);
  assert.deepEqual(decision.reasonCodes, []);
});

test("MemorySelfReinforcementGuard.evaluate accumulates multiple reason codes", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_7",
    evaluatorGeneratedByCandidate: true,
    holdoutPassed: false,
    differentJudgePassed: false,
    humanReviewRequired: true,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.equal(decision.reasonCodes.length, 4);
  assert.ok(decision.reasonCodes.includes("memory.self_generated_evaluator"));
  assert.ok(decision.reasonCodes.includes("memory.holdout_failed"));
  assert.ok(decision.reasonCodes.includes("memory.different_judge_failed"));
  assert.ok(decision.reasonCodes.includes("memory.human_review_required"));
});

test("MemorySelfReinforcementGuard.evaluate handles empty evidence with all false", () => {
  const guard = new MemorySelfReinforcementGuard();
  const evidence: MemoryPromotionEvidence = {
    memoryId: "mem_test_8",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: false,
    differentJudgePassed: false,
    humanReviewRequired: false,
    humanApproved: false,
  };

  const decision = guard.evaluate(evidence);

  assert.equal(decision.promotable, false);
  assert.equal(decision.reasonCodes.length, 2);
  assert.ok(decision.reasonCodes.includes("memory.holdout_failed"));
  assert.ok(decision.reasonCodes.includes("memory.different_judge_failed"));
});
