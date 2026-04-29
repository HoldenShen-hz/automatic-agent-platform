/**
 * ARCH-P2-3: 统一领域元模型 12 问覆盖度测试
 *
 * 验证每个域的元模型回答覆盖所有必答问题。
 * 架构 §37.11 定义统一领域元模型的必答问题。
 *
 * 对应测试手册 §27.3
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  META_MODEL_QUESTION_IDS,
  type DomainMetaModel,
  type MetaModelQuestionId,
} from "../../../../src/domains/canonical-meta-model/types.js";
import { MetaModelValidator, computeMetaModelCompleteness } from "../../../../src/domains/canonical-meta-model/meta-model-validator.js";
import { listVerticalDomainBaselines, type DomainBaseline } from "../../../../src/domains/domain-baseline-catalog.js";

/**
 * 12 个核心问题 ID（基于架构定义）
 * 注意：实际 META_MODEL_QUESTION_IDS 有 17 个问题（含 Q13-Q17）
 * 我们测试所有问题都有答案
 */
const CORE_QUESTION_COUNT = META_MODEL_QUESTION_IDS.length;

test("[ARCH-P2-3] each domain meta-model answers all required questions", () => {
  const baselines = listVerticalDomainBaselines();

  assert.ok(
    baselines.length > 0,
    "Must have at least one domain baseline for testing",
  );

  const domainsWithIncompleteMetaModel: string[] = [];

  for (const baseline of baselines) {
    const metaModel = baseline.metaModel;
    const answeredQuestionIds = new Set<MetaModelQuestionId>();

    for (const answer of metaModel.answers) {
      if (answer.status === "complete" && answer.answer.trim().length > 0) {
        answeredQuestionIds.add(answer.questionId);
      }
    }

    // Check for missing questions
    for (const questionId of META_MODEL_QUESTION_IDS) {
      if (!answeredQuestionIds.has(questionId)) {
        domainsWithIncompleteMetaModel.push(
          `${baseline.domainId}: missing ${questionId}`,
        );
      }
    }
  }

  assert.equal(
    domainsWithIncompleteMetaModel.length,
    0,
    `Domains with incomplete meta-models:\n${domainsWithIncompleteMetaModel.join("\n")}`,
  );
});

test("[ARCH-P2-3] domain meta-model answers are non-trivial", () => {
  const baselines = listVerticalDomainBaselines();

  const domainsWithTrivialAnswers: string[] = [];

  for (const baseline of baselines) {
    const metaModel = baseline.metaModel;

    for (const answer of metaModel.answers) {
      // Answers should be more than just domain ID or generic placeholder
      const isTrivial =
        answer.answer.trim().length < 10 ||
        answer.answer === `${baseline.domainId}` ||
        answer.answer.includes("TODO") ||
        answer.answer.includes("tbd");

      if (isTrivial && answer.status === "complete") {
        domainsWithTrivialAnswers.push(
          `${baseline.domainId}: ${answer.questionId} has trivial answer "${answer.answer}"`,
        );
      }
    }
  }

  assert.equal(
    domainsWithTrivialAnswers.length,
    0,
    `Domains with trivial meta-model answers:\n${domainsWithTrivialAnswers.join("\n")}`,
  );
});

test("[ARCH-P2-3] each domain has meta-model with valid structure", () => {
  const baselines = listVerticalDomainBaselines();

  for (const baseline of baselines) {
    const metaModel = baseline.metaModel;

    assert.ok(metaModel.domainId, "Meta-model must have domainId");
    assert.ok(metaModel.displayName, "Meta-model must have displayName");
    assert.ok(metaModel.version, "Meta-model must have version");
    assert.ok(Array.isArray(metaModel.answers), "Meta-model must have answers array");
    assert.ok(
      metaModel.answers.length === META_MODEL_QUESTION_IDS.length,
      `Domain ${baseline.domainId} must have exactly ${META_MODEL_QUESTION_IDS.length} answers, got ${metaModel.answers.length}`,
    );
  }
});

test("[ARCH-P2-3] meta-model completeness is 100% for all domains", () => {
  const baselines = listVerticalDomainBaselines();
  const validator = new MetaModelValidator();

  const incompleteDomains: string[] = [];

  for (const baseline of baselines) {
    const result = validator.validate(baseline.metaModel);

    if (!result.valid || result.completeness !== 100) {
      incompleteDomains.push(
        `${baseline.domainId}: completeness=${result.completeness}%, missing=${result.missingQuestionIds.join(", ")}`,
      );
    }
  }

  assert.equal(
    incompleteDomains.length,
    0,
    `Domains with incomplete meta-models:\n${incompleteDomains.join("\n")}`,
  );
});

test("[ARCH-P2-3] meta-model validator detects duplicate questions", () => {
  const baselines = listVerticalDomainBaselines();

  for (const baseline of baselines) {
    const validator = new MetaModelValidator();
    const result = validator.validate(baseline.metaModel);

    const duplicateFindings = result.findings.filter((f) =>
      f.includes("duplicate_question"),
    );

    assert.equal(
      duplicateFindings.length,
      0,
      `Domain ${baseline.domainId} has duplicate questions: ${duplicateFindings.join(", ")}`,
    );
  }
});

test("[ARCH-P2-3] meta-model validator detects missing questions", () => {
  const baselines = listVerticalDomainBaselines();

  for (const baseline of baselines) {
    const validator = new MetaModelValidator();
    const result = validator.validate(baseline.metaModel);

    const missingFindings = result.findings.filter((f) =>
      f.includes("missing_question"),
    );

    assert.equal(
      missingFindings.length,
      0,
      `Domain ${baseline.domainId} has missing questions: ${missingFindings.join(", ")}`,
    );
  }
});

test("[ARCH-P2-3] computeMetaModelCompleteness returns correct percentage", () => {
  // Test with a fully complete model
  const completeModel: DomainMetaModel = {
    domainId: "test-domain",
    displayName: "Test Domain",
    version: "v1",
    answers: META_MODEL_QUESTION_IDS.map((qid) => ({
      questionId: qid,
      title: `Question ${qid}`,
      answer: "This is a complete answer with meaningful content.",
      evidenceRefs: ["test:evidence"],
      status: "complete" as const,
    })),
  };

  const completeness = computeMetaModelCompleteness(completeModel);
  assert.equal(completeness, 100, "Fully complete model should have 100% completeness");

  // Test with partially complete model
  const partialModel: DomainMetaModel = {
    domainId: "test-domain-partial",
    displayName: "Test Domain Partial",
    version: "v1",
    answers: META_MODEL_QUESTION_IDS.map((qid, index) => ({
      questionId: qid,
      title: `Question ${qid}`,
      answer: index < 5 ? "Complete answer" : "",
      evidenceRefs: [],
      status: index < 5 ? "complete" as const : "pending" as const,
    })),
  };

  const partialCompleteness = computeMetaModelCompleteness(partialModel);
  const expectedPartial = Math.round((5 / META_MODEL_QUESTION_IDS.length) * 100);
  assert.equal(
    partialCompleteness,
    expectedPartial,
    `Partial model with 5 complete answers should have ${expectedPartial}% completeness`,
  );
});

test("[ARCH-P2-3] all domain baselines have valid meta-model validation", () => {
  const baselines = listVerticalDomainBaselines();
  const validator = new MetaModelValidator();

  for (const baseline of baselines) {
    const validation = validator.validate(baseline.metaModel);

    assert.equal(
      validation.domainId,
      baseline.domainId,
      "Validation result must reference correct domain",
    );

    assert.ok(
      typeof validation.valid === "boolean",
      "Validation must have boolean valid field",
    );

    assert.ok(
      typeof validation.completeness === "number",
      "Validation must have numeric completeness",
    );

    assert.ok(
      Array.isArray(validation.missingQuestionIds),
      "Validation must have missingQuestionIds array",
    );

    assert.ok(
      Array.isArray(validation.findings),
      "Validation must have findings array",
    );
  }
});

test("[ARCH-P2-3] meta-model validator produces no findings for valid model", () => {
  // Create a fully valid model
  const validModel: DomainMetaModel = {
    domainId: "valid-test-domain",
    displayName: "Valid Test Domain",
    version: "v1",
    answers: META_MODEL_QUESTION_IDS.map((qid) => ({
      questionId: qid,
      title: `Question ${qid}`,
      answer: "Complete answer with substantial content for this question.",
      evidenceRefs: ["evidence:1", "evidence:2"],
      status: "complete" as const,
    })),
  };

  const validator = new MetaModelValidator();
  const result = validator.validate(validModel);

  assert.equal(result.valid, true, "Valid model must pass validation");
  assert.equal(result.completeness, 100, "Valid model must have 100% completeness");
  assert.equal(result.missingQuestionIds.length, 0, "Valid model must have no missing questions");
  assert.equal(result.findings.length, 0, "Valid model must have no findings");
});

test("[ARCH-P2-3] every domain must have at least Q1-Q12 questions answered", () => {
  const baselines = listVerticalDomainBaselines();

  // Q1-Q12 are the original 12 questions
  const first12Questions: readonly MetaModelQuestionId[] = META_MODEL_QUESTION_IDS.slice(0, 12);

  const domainsMissingQ1ToQ12: string[] = [];

  for (const baseline of baselines) {
    const answeredIds = new Set(baseline.metaModel.answers.map((a) => a.questionId));

    for (const qid of first12Questions) {
      if (!answeredIds.has(qid)) {
        domainsMissingQ1ToQ12.push(`${baseline.domainId}: missing ${qid}`);
      }
    }
  }

  assert.equal(
    domainsMissingQ1ToQ12.length,
    0,
    `Domains missing Q1-Q12 questions:\n${domainsMissingQ1ToQ12.join("\n")}`,
  );
});