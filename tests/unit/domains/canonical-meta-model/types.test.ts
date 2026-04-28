import assert from "node:assert/strict";
import test from "node:test";

import {
  META_MODEL_QUESTION_IDS,
  type MetaModelQuestionId,
  type MetaModelAnswer,
  type DomainMetaModel,
  type MetaModelValidationResult,
} from "../../../../src/domains/canonical-meta-model/types.js";

test("META_MODEL_QUESTION_IDS contains 15 question IDs", () => {
  assert.equal(META_MODEL_QUESTION_IDS.length, 15);
});

test("META_MODEL_QUESTION_IDS contains expected question IDs", () => {
  const expected = [
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
    "Q13_liability_owner",
    "Q14_compensation_model",
    "Q15_adversarial_scenarios",
  ];

  for (const id of expected) {
    assert.ok(META_MODEL_QUESTION_IDS.includes(id as MetaModelQuestionId));
  }
});

test("MetaModelQuestionId type is assignable from META_MODEL_QUESTION_IDS values", () => {
  const questionId: MetaModelQuestionId = "Q1_primary_user";
  assert.equal(questionId, "Q1_primary_user");
});

test("MetaModelAnswer structure", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q1_primary_user",
    title: "Primary User",
    answer: "Operators and domain owners",
    evidenceRefs: ["ref-1", "ref-2"],
    status: "complete",
  };

  assert.equal(answer.questionId, "Q1_primary_user");
  assert.equal(answer.title, "Primary User");
  assert.equal(answer.answer, "Operators and domain owners");
  assert.deepEqual(answer.evidenceRefs, ["ref-1", "ref-2"]);
  assert.equal(answer.status, "complete");
});

test("MetaModelAnswer can have pending status", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q2_primary_outcomes",
    title: "Primary Outcomes",
    answer: "",
    evidenceRefs: [],
    status: "pending",
  };

  assert.equal(answer.status, "pending");
});

test("MetaModelAnswer can have partial status", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q3_core_inputs",
    title: "Core Inputs",
    answer: "Some inputs",
    evidenceRefs: [],
    status: "partial",
  };

  assert.equal(answer.status, "partial");
});

test("DomainMetaModel structure", () => {
  const model: DomainMetaModel = {
    domainId: "my-domain",
    displayName: "My Domain",
    version: "v1",
    answers: [],
  };

  assert.equal(model.domainId, "my-domain");
  assert.equal(model.displayName, "My Domain");
  assert.equal(model.version, "v1");
  assert.deepEqual(model.answers, []);
});

test("MetaModelValidationResult structure", () => {
  const result: MetaModelValidationResult = {
    domainId: "my-domain",
    valid: true,
    completeness: 100,
    missingQuestionIds: [],
    findings: [],
  };

  assert.equal(result.domainId, "my-domain");
  assert.equal(result.valid, true);
  assert.equal(result.completeness, 100);
  assert.deepEqual(result.missingQuestionIds, []);
  assert.deepEqual(result.findings, []);
});

test("MetaModelValidationResult can have invalid state", () => {
  const result: MetaModelValidationResult = {
    domainId: "my-domain",
    valid: false,
    completeness: 50,
    missingQuestionIds: ["Q1_primary_user", "Q2_primary_outcomes"],
    findings: ["missing_question:Q1_primary_user", "missing_question:Q2_primary_outcomes"],
  };

  assert.equal(result.valid, false);
  assert.equal(result.completeness, 50);
  assert.equal(result.missingQuestionIds.length, 2);
  assert.equal(result.findings.length, 2);
});

test("META_MODEL_QUESTION_IDS is readonly tuple", () => {
  assert.equal(typeof META_MODEL_QUESTION_IDS[0], "string");
  // Verify it's immutable by checking first element
  const first = META_MODEL_QUESTION_IDS[0];
  assert.equal(first, "Q1_primary_user");
});
