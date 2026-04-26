import assert from "node:assert/strict";
import test from "node:test";

import {
  MetaModelValidator,
  computeMetaModelCompleteness,
} from "../../../../src/domains/canonical-meta-model/meta-model-validator.js";
import type { DomainMetaModel, MetaModelAnswer } from "../../../../src/domains/canonical-meta-model/types.js";
import { META_MODEL_QUESTION_IDS } from "../../../../src/domains/canonical-meta-model/types.js";

function createCompleteModel(): DomainMetaModel {
  const answers: MetaModelAnswer[] = META_MODEL_QUESTION_IDS.map((questionId) => ({
    questionId,
    title: `Question ${questionId}`,
    answer: "This is a complete answer with actual content.",
    evidenceRefs: ["evidence-1"],
    status: "complete" as const,
  }));
  return {
    domainId: "test-domain",
    displayName: "Test Domain",
    version: "v1",
    answers,
  };
}

function createIncompleteModel(missingIds: typeof META_MODEL_QUESTION_IDS[number][]): DomainMetaModel {
  const answers: MetaModelAnswer[] = META_MODEL_QUESTION_IDS
    .filter((id) => !missingIds.includes(id))
    .map((questionId) => ({
      questionId,
      title: `Question ${questionId}`,
      answer: "Complete answer",
      evidenceRefs: ["evidence-1"],
      status: "complete" as const,
    }));
  return {
    domainId: "test-domain",
    displayName: "Test Domain",
    version: "v1",
    answers,
  };
}

test("computeMetaModelCompleteness returns 100 for complete model", () => {
  const model = createCompleteModel();
  const completeness = computeMetaModelCompleteness(model);
  assert.equal(completeness, 100);
});

test("computeMetaModelCompleteness returns less than 100 for incomplete model", () => {
  const model = createIncompleteModel(["Q1_primary_user", "Q2_primary_outcomes"]);
  const completeness = computeMetaModelCompleteness(model);
  // 10 out of 12 questions answered = 83.33%
  assert.ok(completeness < 100);
  assert.ok(completeness > 0);
});

test("MetaModelValidator.validate returns valid for complete model", () => {
  const validator = new MetaModelValidator();
  const model = createCompleteModel();
  const result = validator.validate(model);

  assert.equal(result.valid, true);
  assert.equal(result.completeness, 100);
  assert.equal(result.missingQuestionIds.length, 0);
  assert.equal(result.findings.length, 0);
});

test("MetaModelValidator.validate detects missing questions", () => {
  const validator = new MetaModelValidator();
  const model = createIncompleteModel(["Q1_primary_user", "Q5_decision_scope"]);
  const result = validator.validate(model);

  assert.equal(result.valid, false);
  assert.ok(result.missingQuestionIds.includes("Q1_primary_user"));
  assert.ok(result.missingQuestionIds.includes("Q5_decision_scope"));
  assert.ok(result.findings.some((f) => f.includes("missing_question")));
});

test("MetaModelValidator.validate detects duplicate question answers", () => {
  const validator = new MetaModelValidator();
  const duplicateAnswer: MetaModelAnswer = {
    questionId: "Q1_primary_user",
    title: "Primary User",
    answer: "Duplicate answer",
    evidenceRefs: [],
    status: "complete",
  };
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: [
      duplicateAnswer,
      duplicateAnswer,
      ...META_MODEL_QUESTION_IDS.slice(1).map((questionId) => ({
        questionId,
        title: `Question ${questionId}`,
        answer: "Complete answer",
        evidenceRefs: [],
        status: "complete" as const,
      })),
    ],
  };

  const result = validator.validate(model);
  assert.ok(result.findings.some((f) => f.includes("duplicate_question")));
});

test("MetaModelValidator.validate detects incomplete answers", () => {
  const validator = new MetaModelValidator();
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "", // Empty answer
        evidenceRefs: [],
        status: "complete" as const,
      },
    ],
  };

  const result = validator.validate(model);
  assert.ok(result.findings.some((f) => f.includes("incomplete_answer")));
});

test("MetaModelValidator.validate handles pending status answers", () => {
  const validator = new MetaModelValidator();
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: META_MODEL_QUESTION_IDS.map((questionId) => ({
      questionId,
      title: `Question ${questionId}`,
      answer: "Answer content",
      evidenceRefs: [],
      status: "pending" as const,
    })),
  };

  const result = validator.validate(model);
  // Pending status means incomplete even with content
  assert.ok(result.completeness === 0);
});

test("MetaModelValidator.validate returns correct completeness for partial completion", () => {
  const validator = new MetaModelValidator();
  // Exactly half answered
  const half = META_MODEL_QUESTION_IDS.slice(0, 6);
  const model = createIncompleteModel(
    META_MODEL_QUESTION_IDS.filter((id) => !half.includes(id)) as typeof META_MODEL_QUESTION_IDS[number][],
  );

  const result = validator.validate(model);
  assert.equal(result.completeness, 50);
});
