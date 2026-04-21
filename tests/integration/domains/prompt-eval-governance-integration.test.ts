import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvalFramework } from "../../../src/domains/eval-framework/index.js";
import type { DomainPromptLibrary } from "../../../src/domains/prompt-library/index.js";
import { DomainEvaluationGateService } from "../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import { DomainPromptGovernanceService } from "../../../src/domains/prompt-library/domain-prompt-governance-service.js";

const FRAMEWORK: DomainEvalFramework = {
  frameworkId: "eval_release",
  domainId: "coding",
  fewShotExamples: [
    "few-shot-1",
    "few-shot-2",
    "few-shot-3",
    "few-shot-4",
    "few-shot-5",
  ],
  evaluators: [
    { evaluatorId: "tests_pass", metric: "pass_rate", threshold: 0.95, blocking: true },
    { evaluatorId: "security_checks", metric: "security_score", threshold: 0.9, blocking: true },
  ],
  onlineMetrics: ["latency_score"],
  releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
};

const RELEASE_CASES = Array.from({ length: 20 }, (_, index) => {
  const metric = index % 3 === 0 ? "pass_rate" : index % 3 === 1 ? "security_score" : "latency_score";
  const score = metric === "pass_rate" ? 0.99 : metric === "security_score" ? 0.94 : 0.88;
  return {
    caseId: `case_${index + 1}`,
    metric,
    score,
    expectedClass: "coding",
    approvalMatched: true,
  };
});

const LIBRARY: DomainPromptLibrary = {
  libraryId: "prompt_release",
  domainId: "coding",
  prompts: [
    {
      promptId: "release_prompt",
      stage: "release",
      version: "2.0.0",
      template: "Release with checks",
      guardrails: ["approval_required", "tests_required"],
    },
    {
      promptId: "release_prompt",
      stage: "release",
      version: "1.9.0",
      template: "Release legacy",
      guardrails: ["approval_required"],
    },
  ],
};

test("integration: prompt release can enter shadow rollout only after regression gate passes", () => {
  const evalService = new DomainEvaluationGateService();
  const promptService = new DomainPromptGovernanceService();

  const report = evalService.evaluateSuite(FRAMEWORK, {
    suiteId: "suite_release",
    domainId: "coding",
    releaseType: "pre_release",
    executionMode: "supervised",
    storageMode: "mixed",
    cases: RELEASE_CASES,
  });

  assert.equal(report.releaseDecision, "promote");

  const release = promptService.proposeRelease(LIBRARY, {
    promptId: "release_prompt",
    owner: "release_manager",
    rolloutScope: ["tenant:prod-canary"],
    rolloutMode: "shadow",
    lintEvidence: ["lint:ok"],
    evalEvidence: [report.reportId],
    approvalTicketId: "CHG-200",
    rollbackVersion: "1.9.0",
  });

  const active = promptService.activate(release.releaseId);
  assert.equal(active.rolloutMode, "shadow");
  assert.equal(promptService.getActiveRelease("release_prompt")?.version, "2.0.0");
});
