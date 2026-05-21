import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewerAgreementReport,
  buildReviewerDriftReport,
  scoreResearchRubric,
  validateResearchGoldenSet,
  type ResearchQualityRubric,
} from "../../../../../src/platform/prompt-engine/eval/research-quality-validation.js";

const rubric: ResearchQualityRubric = {
  claimFaithfulness: 5,
  evidencePrecision: 4,
  methodUnderstanding: 4,
  experimentReliability: 4,
  selfResearchRelevance: 4,
  actionability: 4,
  riskAwareness: 5,
  noveltyDetection: 4,
  contradictionHandling: 4,
};

test("research quality validation scores rubric and accepts a golden set", () => {
  const score = scoreResearchRubric(rubric);
  const cases = validateResearchGoldenSet([
    {
      caseId: "paper-case",
      paperRef: "paper://case",
      claimEvidenceRefs: ["evidence://claim"],
      expertLabels: ["claim-faithfulness"],
      benchmarkVersion: "v1",
    },
  ]);

  assert.equal(score.passed, true);
  assert.equal(cases.length, 1);
});

test("research quality validation reports reviewer agreement and drift", () => {
  const agreement = buildReviewerAgreementReport([
    { reviewerId: "a", caseId: "paper-case", score: rubric },
    {
      reviewerId: "b",
      caseId: "paper-case",
      score: { ...rubric, actionability: 3 },
    },
  ]);
  const drift = buildReviewerDriftReport(
    [rubric, rubric],
    [rubric, { ...rubric, noveltyDetection: 3 }],
  );

  assert.equal(agreement.passed, true);
  assert.equal(drift.passed, true);
});
