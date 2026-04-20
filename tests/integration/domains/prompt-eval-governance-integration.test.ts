import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvalFramework } from "../../../src/domains/eval-framework/index.js";
import type { DomainPromptLibrary } from "../../../src/domains/prompt-library/index.js";
import { DomainEvaluationGateService } from "../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import { DomainPromptGovernanceService } from "../../../src/domains/prompt-library/domain-prompt-governance-service.js";

const FRAMEWORK: DomainEvalFramework = {
  frameworkId: "eval_release",
  domainId: "coding",
  evaluators: [
    { evaluatorId: "tests_pass", metric: "pass_rate", threshold: 0.95, blocking: true },
    { evaluatorId: "security_checks", metric: "security_score", threshold: 0.9, blocking: true },
  ],
  onlineMetrics: ["latency_score"],
};

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
    cases: [
      { caseId: "case_1", metric: "pass_rate", score: 0.99, expectedClass: "coding" },
      { caseId: "case_2", metric: "security_score", score: 0.94, expectedClass: "coding" },
      { caseId: "case_3", metric: "latency_score", score: 0.88, expectedClass: "coding" },
    ],
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
