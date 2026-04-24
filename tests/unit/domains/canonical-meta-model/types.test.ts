import assert from "node:assert/strict";
import test from "node:test";

import {
  META_MODEL_QUESTION_IDS,
  type MetaModelQuestionId,
  type MetaModelAnswer,
  type DomainMetaModel,
  type MetaModelValidationResult,
} from "../../../../src/domains/canonical-meta-model/types.js";

test("META_MODEL_QUESTION_IDS contains exactly 12 question IDs", () => {
  assert.equal(META_MODEL_QUESTION_IDS.length, 12);
});

test("META_MODEL_QUESTION_IDS contains all expected question IDs", () => {
  const expectedIds = [
    "Q1_primary_user",
    "Q2_primary_outcomes",
    "Q3_core_inputs",
    "Q4_authoritative_sources",
    "Q5_decision_scope",
    "Q6_risk_hotspots",
    "Q7_required_tools",
    "Q8_workflow_shape",
    "Q9_eval_metrics",
    "Q10_human_governance",
    "Q11_latency_sla",
    "Q12_pre_launch_certs",
  ];

  for (const id of expectedIds) {
    assert.ok(
      META_MODEL_QUESTION_IDS.includes(id as MetaModelQuestionId),
      `Expected ${id} to be in META_MODEL_QUESTION_IDS`,
    );
  }
});

test("META_MODEL_QUESTION_IDS is a readonly tuple", () => {
  const tupleLength = META_MODEL_QUESTION_IDS.length;
  assert.equal(tupleLength, 12);

  // Verify it's a readonly array by checking individual elements
  assert.equal(META_MODEL_QUESTION_IDS[0], "Q1_primary_user");
  assert.equal(META_MODEL_QUESTION_IDS[11], "Q12_pre_launch_certs");
});

test("MetaModelAnswer accepts valid answer structure", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q1_primary_user",
    title: "Primary User",
    answer: "Development teams",
    evidenceRefs: ["doc_1", "doc_2"],
    status: "complete",
  };

  assert.equal(answer.questionId, "Q1_primary_user");
  assert.equal(answer.title, "Primary User");
  assert.equal(answer.answer, "Development teams");
  assert.deepEqual(answer.evidenceRefs, ["doc_1", "doc_2"]);
  assert.equal(answer.status, "complete");
});

test("MetaModelAnswer accepts all status values", () => {
  const statuses: MetaModelAnswer["status"][] = ["complete", "partial", "pending"];

  for (const status of statuses) {
    const answer: MetaModelAnswer = {
      questionId: "Q1_primary_user",
      title: "Test",
      answer: "Test answer",
      evidenceRefs: [],
      status,
    };
    assert.equal(answer.status, status);
  }
});

test("DomainMetaModel accepts valid model structure", () => {
  const model: DomainMetaModel = {
    domainId: "coding",
    displayName: "Coding",
    version: "1.0.0",
    answers: [],
  };

  assert.equal(model.domainId, "coding");
  assert.equal(model.displayName, "Coding");
  assert.equal(model.version, "1.0.0");
  assert.deepEqual(model.answers, []);
});

test("DomainMetaModel accepts model with answers", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q1_primary_user",
    title: "Primary User",
    answer: "Dev teams",
    evidenceRefs: ["ref_1"],
    status: "complete",
  };

  const model: DomainMetaModel = {
    domainId: "data-engineering",
    displayName: "Data Engineering",
    version: "2.0.0",
    answers: [answer],
  };

  assert.equal(model.answers.length, 1);
  assert.equal(model.answers[0]!.questionId, "Q1_primary_user");
});

test("MetaModelValidationResult accepts valid structure", () => {
  const result: MetaModelValidationResult = {
    domainId: "coding",
    valid: true,
    completeness: 0.85,
    missingQuestionIds: ["Q5_decision_scope", "Q6_risk_hotspots"],
    findings: ["Missing decision scope", "Risk analysis incomplete"],
  };

  assert.equal(result.domainId, "coding");
  assert.equal(result.valid, true);
  assert.equal(result.completeness, 0.85);
  assert.equal(result.missingQuestionIds.length, 2);
  assert.equal(result.findings.length, 2);
});

test("MetaModelValidationResult can be invalid with empty missingQuestionIds", () => {
  const result: MetaModelValidationResult = {
    domainId: "coding",
    valid: true,
    completeness: 1.0,
    missingQuestionIds: [],
    findings: [],
  };

  assert.equal(result.valid, true);
  assert.equal(result.completeness, 1.0);
  assert.equal(result.missingQuestionIds.length, 0);
  assert.equal(result.findings.length, 0);
});

test("MetaModelQuestionId type accepts any valid question ID", () => {
  const questionId: MetaModelQuestionId = "Q1_primary_user";
  assert.equal(questionId, "Q1_primary_user");

  const questionId2: MetaModelQuestionId = "Q12_pre_launch_certs";
  assert.equal(questionId2, "Q12_pre_launch_certs");
});

test("MetaModelQuestionId can be used to index META_MODEL_QUESTION_IDS", () => {
  const id: MetaModelQuestionId = META_MODEL_QUESTION_IDS[0];
  assert.equal(id, "Q1_primary_user");
});

test("META_MODEL_QUESTION_IDS can be iterated", () => {
  const ids = [...META_MODEL_QUESTION_IDS];
  assert.equal(ids.length, 12);
  assert.equal(ids[0], "Q1_primary_user");
  assert.equal(ids[11], "Q12_pre_launch_certs");
});

test("META_MODEL_QUESTION_IDS includes Q9 through Q12 for eval and governance", () => {
  const evalAndGovernanceIds = META_MODEL_QUESTION_IDS.filter((id) =>
    id.startsWith("Q9_") || id.startsWith("Q10_") || id.startsWith("Q11_") || id.startsWith("Q12_")
  );

  assert.equal(evalAndGovernanceIds.length, 4);
  assert.ok(META_MODEL_QUESTION_IDS.includes("Q9_eval_metrics"));
  assert.ok(META_MODEL_QUESTION_IDS.includes("Q10_human_governance"));
  assert.ok(META_MODEL_QUESTION_IDS.includes("Q11_latency_sla"));
  assert.ok(META_MODEL_QUESTION_IDS.includes("Q12_pre_launch_certs"));
});
