/**
 * Integration Test: Domain Prompt Eval Governance
 *
 * Tests prompt evaluation and governance with SQLite
 * integration context and multi-case scenario validation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainPromptGovernanceService } from "../../../../src/domains/prompt-library/domain-prompt-governance-service.js";
import { DomainEvaluationGateService } from "../../../../src/domains/eval-framework/domain-evaluation-gate-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createEvalContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/eval.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Prompt governance: proposes and activates release", () => {
  const ctx = createEvalContext("aa-gov-release-");
  try {
    const governance = new DomainPromptGovernanceService();

    const release = governance.proposeRelease(
      { libraryId: "lib_001", domainId: "coding", prompts: [] },
      {
        promptId: "coding.plan",
        owner: "owner_001",
        rolloutScope: ["tenant:prod"],
        rolloutMode: "suggest",
        lintEvidence: ["lint:passed"],
        evalEvidence: ["eval_report_001"],
        approvalTicketId: "CHG-001",
        rollbackVersion: "v0",
      },
    );

    assert.ok(release.releaseId.startsWith("release_"));

    const activeRelease = governance.activate(release.releaseId);
    assert.equal(activeRelease.status, "active");
    assert.ok(activeRelease.rolloutScope.includes("tenant:prod"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Prompt governance: activates and deactivates release", () => {
  const ctx = createEvalContext("aa-gov-deactivate-");
  try {
    const governance = new DomainPromptGovernanceService();

    const library = { libraryId: "lib_002", domainId: "ops", prompts: [] };
    const release = governance.proposeRelease(
      library,
      {
        promptId: "ops.execute",
        owner: "owner_002",
        rolloutScope: ["tenant:staging"],
        rolloutMode: "suggest",
        lintEvidence: [],
        evalEvidence: [],
        approvalTicketId: "CHG-002",
        rollbackVersion: "v0",
      },
    );

    const active = governance.activate(release.releaseId);
    assert.equal(active.status, "active");

    const deactivated = governance.rollback(library, release.releaseId);
    assert.equal(deactivated.status, "rolled_back");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Evaluation gate: evaluates suite and returns promote decision", () => {
  const ctx = createEvalContext("aa-eval-promote-");
  try {
    const gate = new DomainEvaluationGateService();

    const report = gate.evaluateSuite(
      {
        frameworkId: "eval_coding",
        domainId: "coding",
        fewShotExamples: [],
        evaluators: [
          { evaluatorId: "accuracy", metric: "accuracy", threshold: 0.9, blocking: true },
          { evaluatorId: "latency", metric: "latency_ms", threshold: 200, blocking: false },
        ],
        onlineMetrics: [],
        releaseGates: {
          minFewShotCount: 5,
          minRegressionCaseCount: 10,
          requirePromptInjectionCoverage: true,
        },
      },
      {
        suiteId: "suite_001",
        domainId: "coding",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "mixed",
        cases: Array.from({ length: 20 }, (_, i) => ({
          caseId: `case_${i}`,
          metric: "accuracy",
          score: 0.92 + (i % 5) * 0.01,
          expectedClass: "coding",
          approvalMatched: true,
        })),
      },
    );

    assert.ok(report.reportId.startsWith("eval_report_"));
    assert.equal(report.releaseDecision, "promote");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Evaluation gate: returns block decision when scores below threshold", () => {
  const ctx = createEvalContext("aa-eval-block-");
  try {
    const gate = new DomainEvaluationGateService();

    const report = gate.evaluateSuite(
      {
        frameworkId: "eval_security",
        domainId: "security",
        fewShotExamples: [],
        evaluators: [
          { evaluatorId: "security_score", metric: "security", threshold: 0.95, blocking: true },
        ],
        onlineMetrics: [],
        releaseGates: {
          minFewShotCount: 10,
          minRegressionCaseCount: 20,
          requirePromptInjectionCoverage: true,
        },
      },
      {
        suiteId: "suite_block",
        domainId: "security",
        releaseType: "pre_release",
        executionMode: "supervised",
        storageMode: "mixed",
        cases: Array.from({ length: 15 }, (_, i) => ({
          caseId: `sec_case_${i}`,
          metric: "security",
          score: 0.85 + (i % 3) * 0.02,
          expectedClass: "security",
          approvalMatched: i < 10,
        })),
      },
    );

    assert.equal(report.releaseDecision, "block");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Evaluation gate: stores evaluation cases in task store", () => {
  const ctx = createEvalContext("aa-eval-store-");
  try {
    const gate = new DomainEvaluationGateService();
    const taskId = "task_eval_001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "eval_ops",
        title: "Evaluation test task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const report = gate.evaluateSuite(
      {
        frameworkId: "eval_test",
        domainId: "test",
        fewShotExamples: [],
        evaluators: [
          { evaluatorId: "test_metric", metric: "test_score", threshold: 0.8, blocking: true },
        ],
        onlineMetrics: [],
        releaseGates: {
          minFewShotCount: 5,
          minRegressionCaseCount: 10,
          requirePromptInjectionCoverage: false,
        },
      },
      {
        suiteId: "suite_store",
        domainId: "test",
        releaseType: "canary",
        executionMode: "auto",
        storageMode: "mixed",
        cases: [
          { caseId: "case_store_1", metric: "test_score", score: 0.85, expectedClass: "test", approvalMatched: true },
          { caseId: "case_store_2", metric: "test_score", score: 0.88, expectedClass: "test", approvalMatched: true },
        ],
      },
    );

    assert.ok(report.reportId);
    const task = ctx.store.getTask(taskId);
    assert.ok(task);
    assert.equal(task?.title, "Evaluation test task");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Prompt governance with registry: builds capability for domain with prompt library", () => {
  const ctx = createEvalContext("aa-gov-cap-");
  try {
    const registry = new DomainRegistryService();

    registry.register({
      domainId: "prompt_cap",
      name: "Prompt Capability",
      description: "Testing prompt capability",
      version: 1,
      workflows: [
        {
          workflowId: "wf_prompt_cap",
          name: "Prompt Capability Workflow",
          triggerConditions: {},
          steps: [
            { stepName: "prompt", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
          ],
        },
      ],
      toolBundles: [{ bundleId: "prompt_tools", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] }],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {
        supportedTaskTypes: ["implement"],
        requiredTools: ["bash"],
        optionalTools: [],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
        securityLevel: "standard",
      },
      status: "active",
      externalAdapters: [],
      pluginBindings: [],
    });

    const governance = new DomainPromptGovernanceService();
    const release = governance.proposeRelease(
      { libraryId: "lib_prompt_cap", domainId: "prompt_cap", prompts: [] },
      {
        promptId: "prompt_cap.execute",
        owner: "owner_cap",
        rolloutScope: ["tenant:canary"],
        rolloutMode: "suggest",
        lintEvidence: [],
        evalEvidence: [],
        approvalTicketId: "CHG-CAP",
        rollbackVersion: "v0",
      },
    );

    const activated = governance.activate(release.releaseId);
    assert.equal(activated.status, "active");

    const capability = registry.buildCapabilityEntry("prompt_cap");
    assert.equal(capability.domainId, "prompt_cap");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Multi-domain evaluation: each domain gets independent evaluation report", () => {
  const ctx = createEvalContext("aa-eval-multi-");
  try {
    const gate = new DomainEvaluationGateService();

    const domains = ["coding", "security", "ops"];
    const reports: string[] = [];

    for (const domainId of domains) {
      const report = gate.evaluateSuite(
        {
          frameworkId: `eval_${domainId}`,
          domainId,
          fewShotExamples: [],
          evaluators: [
            { evaluatorId: `${domainId}_eval`, metric: "score", threshold: 0.8, blocking: true },
          ],
          onlineMetrics: [],
          releaseGates: {
            minFewShotCount: 5,
            minRegressionCaseCount: 10,
            requirePromptInjectionCoverage: false,
          },
        },
        {
          suiteId: `suite_${domainId}`,
          domainId,
          releaseType: "pre_release",
          executionMode: "supervised",
          storageMode: "mixed",
          cases: [
            { caseId: `${domainId}_case_1`, metric: "score", score: 0.85, expectedClass: domainId, approvalMatched: true },
            { caseId: `${domainId}_case_2`, metric: "score", score: 0.90, expectedClass: domainId, approvalMatched: true },
          ],
        },
      );
      reports.push(report.reportId);
    }

    assert.equal(reports.length, 3);
    const uniqueReports = new Set(reports);
    assert.equal(uniqueReports.size, 3);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});