import assert from "node:assert/strict";
import test from "node:test";

import {
  MemorySelfReinforcementGuard,
  type MemoryPromotionEvidence,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-self-reinforcement-guard.js";

function createEvidence(overrides: Partial<MemoryPromotionEvidence> = {}): MemoryPromotionEvidence {
  return {
    memoryId: "mem_test",
    evaluatorGeneratedByCandidate: false,
    holdoutPassed: true,
    differentJudgePassed: true,
    humanReviewRequired: false,
    humanApproved: false,
    attestationVerified: true,
    holdoutEvidenceRef: "artifact://holdout/eval-1",
    holdoutEvidenceVerified: true,
    differentJudgeEvidenceRef: "artifact://judge/eval-1",
    differentJudgeEvidenceVerified: true,
    humanReviewEvidenceRef: null,
    humanReviewerId: null,
    humanReviewEvidenceVerified: false,
    ...overrides,
  };
}

test("MemorySelfReinforcementGuard.evaluate returns promotable=true for ideal evidence", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence());

  assert.equal(decision.promotable, true);
  assert.deepEqual(decision.reasonCodes, []);
});

test("MemorySelfReinforcementGuard.evaluate flags self_generated_evaluator", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    evaluatorGeneratedByCandidate: true,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.self_generated_evaluator"));
});

test("MemorySelfReinforcementGuard.evaluate flags holdout_failed", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    holdoutPassed: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.holdout_failed"));
});

test("MemorySelfReinforcementGuard.evaluate requires verified holdout evidence, not just a caller boolean", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    holdoutEvidenceRef: null,
    holdoutEvidenceVerified: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.holdout_evidence_missing"));
});

test("MemorySelfReinforcementGuard.evaluate flags different_judge_failed", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    differentJudgePassed: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.different_judge_failed"));
});

test("MemorySelfReinforcementGuard.evaluate requires independent judge evidence proof", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    differentJudgeEvidenceRef: "",
    differentJudgeEvidenceVerified: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.different_judge_evidence_missing"));
});

test("MemorySelfReinforcementGuard.evaluate flags human_review_required when not approved", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    humanReviewRequired: true,
    humanApproved: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.human_review_required"));
});

test("MemorySelfReinforcementGuard.evaluate requires reviewer identity and evidence when human review passed", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    humanReviewRequired: true,
    humanApproved: true,
    humanReviewEvidenceRef: null,
    humanReviewerId: null,
    humanReviewEvidenceVerified: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.human_review_evidence_missing"));
});

test("MemorySelfReinforcementGuard.evaluate allows promotable when human review proof is present", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    humanReviewRequired: true,
    humanApproved: true,
    humanReviewEvidenceRef: "artifact://human-review/approval-1",
    humanReviewerId: "reviewer-1",
    humanReviewEvidenceVerified: true,
  }));

  assert.equal(decision.promotable, true);
  assert.deepEqual(decision.reasonCodes, []);
});

test("MemorySelfReinforcementGuard.evaluate accumulates multiple reason codes", () => {
  const guard = new MemorySelfReinforcementGuard();

  const decision = guard.evaluate(createEvidence({
    evaluatorGeneratedByCandidate: true,
    holdoutPassed: false,
    differentJudgePassed: false,
    humanReviewRequired: true,
    humanApproved: false,
    attestationVerified: false,
  }));

  assert.equal(decision.promotable, false);
  assert.ok(decision.reasonCodes.includes("memory.attestation_missing"));
  assert.ok(decision.reasonCodes.includes("memory.self_generated_evaluator"));
  assert.ok(decision.reasonCodes.includes("memory.holdout_failed"));
  assert.ok(decision.reasonCodes.includes("memory.different_judge_failed"));
  assert.ok(decision.reasonCodes.includes("memory.human_review_required"));
});
