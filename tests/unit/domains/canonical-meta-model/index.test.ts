/**
 * Unit tests for domains/canonical-meta-model/index.ts barrel exports
 *
 * @see src/domains/canonical-meta-model/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  META_MODEL_QUESTION_IDS,
  MetaModelValidator,
  computeMetaModelCompleteness,
  seedDomainMetaModel,
  seedDomainMetaModels,
  type DomainMetaModel,
  type MetaModelQuestionId,
  type MetaModelAnswer,
  type MetaModelValidationResult,
} from "../../../../src/domains/canonical-meta-model/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// META_MODEL_QUESTION_IDS
// ─────────────────────────────────────────────────────────────────────────────

test("META_MODEL_QUESTION_IDS contains exactly 12 question IDs", () => {
  assert.equal(META_MODEL_QUESTION_IDS.length, 12);
});

test("META_MODEL_QUESTION_IDS contains expected question IDs in order", () => {
  assert.deepEqual(META_MODEL_QUESTION_IDS, [
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
  ]);
});

test("META_MODEL_QUESTION_IDS is an array of 12 question ID strings", () => {
  assert.ok(Array.isArray(META_MODEL_QUESTION_IDS));
  assert.equal(typeof META_MODEL_QUESTION_IDS[0], "string");
});

// ─────────────────────────────────────────────────────────────────────────────
// MetaModelQuestionId type alias
// ─────────────────────────────────────────────────────────────────────────────

test("MetaModelQuestionId type accepts valid question IDs", () => {
  const validIds: MetaModelQuestionId[] = [
    "Q1_primary_user",
    "Q2_primary_outcomes",
    "Q12_pre_launch_certs",
  ];
  assert.equal(validIds.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// MetaModelAnswer structure
// ─────────────────────────────────────────────────────────────────────────────

test("MetaModelAnswer structure with complete status", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q1_primary_user",
    title: "Primary User",
    answer: "Test answer text",
    evidenceRefs: ["evidence:1", "evidence:2"],
    status: "complete",
  };
  assert.equal(answer.questionId, "Q1_primary_user");
  assert.equal(answer.status, "complete");
  assert.equal(answer.evidenceRefs.length, 2);
});

test("MetaModelAnswer structure with partial status", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q2_primary_outcomes",
    title: "Primary Outcomes",
    answer: "Partial answer",
    evidenceRefs: [],
    status: "partial",
  };
  assert.equal(answer.status, "partial");
});

test("MetaModelAnswer structure with pending status", () => {
  const answer: MetaModelAnswer = {
    questionId: "Q3_core_inputs",
    title: "Core Inputs",
    answer: "",
    evidenceRefs: [],
    status: "pending",
  };
  assert.equal(answer.status, "pending");
});

// ─────────────────────────────────────────────────────────────────────────────
// DomainMetaModel structure
// ─────────────────────────────────────────────────────────────────────────────

test("DomainMetaModel structure is correct", () => {
  const model: DomainMetaModel = {
    domainId: "test-domain",
    displayName: "Test Domain",
    version: "v1",
    answers: [],
  };
  assert.equal(model.domainId, "test-domain");
  assert.equal(model.displayName, "Test Domain");
  assert.equal(model.version, "v1");
  assert.ok(Array.isArray(model.answers));
});

test("DomainMetaModel accepts fully populated answers", () => {
  const model = seedDomainMetaModel({
    domainId: "coding",
    displayName: "Coding Domain",
    ownerOrgNodeId: "org.coding",
    taskTypes: ["coding", "review"],
    tags: ["development"],
    riskLevel: "medium",
  });
  assert.equal(model.domainId, "coding");
  assert.equal(model.answers.length, 12);
});

// ─────────────────────────────────────────────────────────────────────────────
// MetaModelValidationResult structure
// ─────────────────────────────────────────────────────────────────────────────

test("MetaModelValidationResult structure for valid model", () => {
  const result: MetaModelValidationResult = {
    domainId: "test-domain",
    valid: true,
    completeness: 100,
    missingQuestionIds: [],
    findings: [],
  };
  assert.equal(result.valid, true);
  assert.equal(result.completeness, 100);
  assert.ok(Array.isArray(result.missingQuestionIds));
  assert.ok(Array.isArray(result.findings));
});

test("MetaModelValidationResult structure for invalid model", () => {
  const result: MetaModelValidationResult = {
    domainId: "test-domain",
    valid: false,
    completeness: 75,
    missingQuestionIds: ["Q10_human_governance"],
    findings: ["domain_meta_model.missing_question:Q10_human_governance"],
  };
  assert.equal(result.valid, false);
  assert.equal(result.completeness, 75);
  assert.equal(result.missingQuestionIds.length, 1);
  assert.equal(result.findings.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// seedDomainMetaModel
// ─────────────────────────────────────────────────────────────────────────────

test("seedDomainMetaModel creates model with 12 answers", () => {
  const model = seedDomainMetaModel({
    domainId: "ecommerce",
    displayName: "E-commerce",
    ownerOrgNodeId: "org.ecommerce",
    taskTypes: ["catalog", "checkout"],
    tags: ["retail", "commerce"],
    riskLevel: "high",
  });
  assert.equal(model.answers.length, 12);
});

test("seedDomainMetaModel creates model with correct domainId", () => {
  const model = seedDomainMetaModel({
    domainId: "healthcare",
    displayName: "Healthcare Domain",
    ownerOrgNodeId: "org.healthcare",
    taskTypes: ["diagnosis"],
    tags: ["medical"],
    riskLevel: "critical",
  });
  assert.equal(model.domainId, "healthcare");
});

test("seedDomainMetaModel creates model with all complete answers", () => {
  const model = seedDomainMetaModel({
    domainId: "finance",
    displayName: "Finance",
    ownerOrgNodeId: "org.finance",
    taskTypes: ["analysis"],
    tags: ["financial"],
    riskLevel: "critical",
  });
  const allComplete = model.answers.every((a) => a.status === "complete");
  assert.ok(allComplete, "All answers should be complete");
});

test("seedDomainMetaModel includes evidence refs with domain info", () => {
  const model = seedDomainMetaModel({
    domainId: "test-domain",
    displayName: "Test Domain",
    ownerOrgNodeId: "org.test",
    taskTypes: ["test"],
    tags: ["testing"],
    riskLevel: "medium",
  });
  for (const answer of model.answers) {
    assert.ok(answer.evidenceRefs.some((ref) => ref.startsWith("domain:") || ref.startsWith("owner:")), `Answer ${answer.questionId} should have domain or owner evidence refs`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// seedDomainMetaModels
// ─────────────────────────────────────────────────────────────────────────────

test("seedDomainMetaModels creates multiple models", () => {
  const inputs = [
    {
      domainId: "domain-1",
      displayName: "Domain One",
      ownerOrgNodeId: "org.1",
      taskTypes: ["task-1"] as const,
      tags: ["tag-1"] as const,
      riskLevel: "medium" as const,
    },
    {
      domainId: "domain-2",
      displayName: "Domain Two",
      ownerOrgNodeId: "org.2",
      taskTypes: ["task-2"] as const,
      tags: ["tag-2"] as const,
      riskLevel: "high" as const,
    },
  ];
  const models = seedDomainMetaModels(inputs);
  assert.equal(models.length, 2);
  assert.equal(models[0]?.domainId, "domain-1");
  assert.equal(models[1]?.domainId, "domain-2");
});

test("seedDomainMetaModels with empty array returns empty array", () => {
  const models = seedDomainMetaModels([]);
  assert.ok(Array.isArray(models));
  assert.equal(models.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// computeMetaModelCompleteness
// ─────────────────────────────────────────────────────────────────────────────

test("computeMetaModelCompleteness returns 100 for fully complete model", () => {
  const model = seedDomainMetaModel({
    domainId: "test",
    displayName: "Test",
    ownerOrgNodeId: "org.test",
    taskTypes: ["test"],
    tags: ["testing"],
    riskLevel: "medium",
  });
  assert.equal(computeMetaModelCompleteness(model), 100);
});

test("computeMetaModelCompleteness returns 0 for empty answers", () => {
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: [],
  };
  assert.equal(computeMetaModelCompleteness(model), 0);
});

test("computeMetaModelCompleteness calculates correct percentage", () => {
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "Test user",
        evidenceRefs: [],
        status: "complete",
      },
      {
        questionId: "Q2_primary_outcomes",
        title: "Primary Outcomes",
        answer: "", // Empty answer won't be counted
        evidenceRefs: [],
        status: "complete",
      },
      {
        questionId: "Q3_core_inputs",
        title: "Core Inputs",
        answer: "Test inputs",
        evidenceRefs: [],
        status: "complete",
      },
    ],
  };
  // Only Q1 and Q3 have non-empty answers, but denominator is 12 (all META_MODEL_QUESTION_IDS)
  // So: 2/12 = 16.67%
  assert.equal(computeMetaModelCompleteness(model), 16.67);
});

test("computeMetaModelCompleteness only counts complete answers with content", () => {
  const model: DomainMetaModel = {
    domainId: "test",
    displayName: "Test",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "Test user",
        evidenceRefs: [],
        status: "complete",
      },
      {
        questionId: "Q2_primary_outcomes",
        title: "Primary Outcomes",
        answer: "", // Empty - won't count even though status is "complete"
        evidenceRefs: [],
        status: "complete",
      },
    ],
  };
  // Q1 has answer, Q2 has empty answer. Denominator is 12 (all META_MODEL_QUESTION_IDS)
  // Only 1 complete with non-empty answer: 1/12 = 8.33%
  assert.equal(computeMetaModelCompleteness(model), 8.33);
});

// ─────────────────────────────────────────────────────────────────────────────
// MetaModelValidator
// ─────────────────────────────────────────────────────────────────────────────

test("MetaModelValidator.validate returns valid for complete model", () => {
  const model = seedDomainMetaModel({
    domainId: "complete-domain",
    displayName: "Complete Domain",
    ownerOrgNodeId: "org.complete",
    taskTypes: ["task"],
    tags: ["tag"],
    riskLevel: "medium",
  });
  const validator = new MetaModelValidator();
  const result = validator.validate(model);
  assert.equal(result.valid, true);
  assert.equal(result.completeness, 100);
  assert.equal(result.missingQuestionIds.length, 0);
  assert.equal(result.findings.length, 0);
});

test("MetaModelValidator.validate detects missing questions", () => {
  const model: DomainMetaModel = {
    domainId: "incomplete-domain",
    displayName: "Incomplete Domain",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "Test user",
        evidenceRefs: [],
        status: "complete",
      },
    ],
  };
  const validator = new MetaModelValidator();
  const result = validator.validate(model);
  assert.equal(result.valid, false);
  assert.ok(result.missingQuestionIds.length > 0);
  assert.ok(result.findings.some((f) => f.includes("missing_question")));
});

test("MetaModelValidator.validate detects duplicate questions", () => {
  const model: DomainMetaModel = {
    domainId: "duplicate-domain",
    displayName: "Duplicate Domain",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "First answer",
        evidenceRefs: [],
        status: "complete",
      },
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "Second answer",
        evidenceRefs: [],
        status: "complete",
      },
    ],
  };
  const validator = new MetaModelValidator();
  const result = validator.validate(model);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((f) => f.includes("duplicate_question")));
});

test("MetaModelValidator.validate detects incomplete answers", () => {
  const model: DomainMetaModel = {
    domainId: "partial-domain",
    displayName: "Partial Domain",
    version: "v1",
    answers: [
      {
        questionId: "Q1_primary_user",
        title: "Primary User",
        answer: "", // Empty answer
        evidenceRefs: [],
        status: "complete",
      },
    ],
  };
  const validator = new MetaModelValidator();
  const result = validator.validate(model);
  assert.equal(result.valid, false);
  assert.ok(result.findings.some((f) => f.includes("incomplete_answer")));
});

test("MetaModelValidator.validate uses domainId from model", () => {
  const model = seedDomainMetaModel({
    domainId: "my-special-domain",
    displayName: "My Special Domain",
    ownerOrgNodeId: "org.special",
    taskTypes: ["special"],
    tags: ["tag"],
    riskLevel: "high",
  });
  const validator = new MetaModelValidator();
  const result = validator.validate(model);
  assert.equal(result.domainId, "my-special-domain");
});