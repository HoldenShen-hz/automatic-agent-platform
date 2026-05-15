/**
 * Integration Test: Domain Onboarding Integration
 *
 * Tests domain onboarding flow with SQLite task store
 * and multi-phase progression validation.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { DomainSmokeTestRunner } from "../../../../src/domains/registry/domain-smoke-test.js";
import { DomainTaskDesignService } from "../../../../src/domains/domain-task-design-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createOnboardingContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/onboarding.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Onboarding: advances through all phases and completes", () => {
  const ctx = createOnboardingContext("aa-onboard-full-");
  try {
    const registry = new DomainRegistryService();

    registry.register({
      domainId: "full_onboard",
      name: "Full Onboarding",
      description: "Complete onboarding test",
      version: 1,
      workflows: [
        {
          workflowId: "wf_full",
          name: "Full Workflow",
          triggerConditions: {},
          steps: [
            { stepName: "step1", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
            { stepName: "step2", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: ["step1"] },
          ],
        },
      ],
      toolBundles: [{ bundleId: "full_tools", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] }],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {
        supportedTaskTypes: ["implement"],
        requiredTools: ["bash"],
        optionalTools: [],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
        securityLevel: "restricted",
      },
      status: "validated",
      externalAdapters: [],
      pluginBindings: [],
    });

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("full_onboard");

    const phases = ["domain_modeling", "pack_development", "security_certification", "gray_rollout"] as const;
    for (const phase of phases) {
      const session = onboarding.get("full_onboard");
      if (session.activePhase === phase) {
        onboarding.advance("full_onboard", [`${phase}:evidence`, `${phase}:rollback-plan`]);
      }
    }

    assert.equal(onboarding.get("full_onboard")?.completed, true);
    assert.equal(registry.get("full_onboard")?.status, "active");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Onboarding: smoke test runs and passes for active domain", () => {
  const ctx = createOnboardingContext("aa-onboard-smoke-");
  try {
    const registry = new DomainRegistryService();

    registry.register({
      domainId: "smoke_test_domain",
      name: "Smoke Test Domain",
      description: "Smoke test",
      version: 1,
      workflows: [
        {
          workflowId: "wf_smoke",
          name: "Smoke Workflow",
          triggerConditions: {},
          steps: [
            { stepName: "prepare", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
            { stepName: "test", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: ["prepare"] },
          ],
        },
      ],
      toolBundles: [{ bundleId: "smoke_tools", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] }],
      outputContracts: [],
      promptOverrides: {},
      capabilities: {
        supportedTaskTypes: ["test"],
        requiredTools: ["bash"],
        optionalTools: [],
        modelPreferences: {},
        budgetLimits: { maxTokensPerTask: 1000, maxCostPerTask: 1 },
        securityLevel: "restricted",
      },
      status: "active",
      externalAdapters: [],
      pluginBindings: [],
    });

    const definition = registry.get("smoke_test_domain");
    assert.ok(definition);

    const smoke = new DomainSmokeTestRunner().run(definition);
    assert.equal(smoke.passed, true);
    assert.ok(smoke.rollbackPoints.length >= 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Onboarding: task design service creates workflow for domain", () => {
  const ctx = createOnboardingContext("aa-onboard-design-");
  try {
    const registry = new DomainRegistryService();
    const now = nowIso();

    registry.register({
      domainId: "design_test",
      name: "Design Test",
      description: "Task design test",
      version: 1,
      workflows: [
        {
          workflowId: "wf_design",
          name: "Design Workflow",
          triggerConditions: {},
          steps: [
            { stepName: "design", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
          ],
        },
      ],
      toolBundles: [{ bundleId: "design_tools", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] }],
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

    const taskDesignService = new DomainTaskDesignService({
      recipes: [
        {
          recipeId: "recipe_design",
          domainId: "design_test",
          triggerPhrases: ["design", "workflow"],
          defaultWorkflowId: "design_test.primary",
          defaultToolBundleIds: ["design_tools"],
          archetype: "conversational",
        },
      ],
      promptLibrary: {
        libraryId: "prompt_lib",
        domainId: "design_test",
        prompts: [
          {
            promptId: "design_test.prompt",
            stage: "plan",
            version: "1.0",
            template: "Design the workflow carefully",
            guardrails: [],
          },
        ],
      },
      riskProfile: { profileId: "risk_1", domainId: "design_test", defaultRiskLevel: "low", dimensions: [] },
      evalFramework: { frameworkId: "eval_1", domainId: "design_test", fewShotExamples: [], evaluators: [], onlineMetrics: [], releaseGates: { minFewShotCount: 0, minRegressionCaseCount: 0, requirePromptInjectionCoverage: false } },
      knowledgeSchema: { schemaId: "know_1", domainId: "design_test", namespaceIds: [], freshnessWindowHours: 24, conflictResolution: "trust_priority", retentionDays: 30, knowledgeSources: [], retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false }, freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true } },
      interactionRules: [],
    });

    const design = taskDesignService.design({
      domainId: "design_test",
      taskType: "implement",
      userInput: "design a test workflow",
      promptId: "design_test.prompt",
      riskScore: 50,
    });

    assert.equal(design.workflowId, "design_test.primary");
    assert.ok(design.prompt);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Onboarding: persists task and execution during onboarding", () => {
  const ctx = createOnboardingContext("aa-onboard-persist-");
  try {
    const registry = new DomainRegistryService();
    const taskId = "task_onboard_001";
    const executionId = "exec_onboard_001";
    const now = nowIso();

    registry.register({
      domainId: "persist_test",
      name: "Persist Test",
      description: "Persistence test",
      version: 1,
      workflows: [
        {
          workflowId: "wf_persist",
          name: "Persist Workflow",
          triggerConditions: {},
          steps: [
            { stepName: "persist", toolHints: ["bash"], modelHints: {}, outputSchema: null, retryPolicy: { maxRetries: 0, backoffMs: 0 }, requiresReview: false, timeoutMs: 60000, dependsOn: [] },
          ],
        },
      ],
      toolBundles: [{ bundleId: "persist_tools", tools: [{ toolName: "bash", enabled: true, configOverrides: {} }] }],
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
      status: "testing",
      externalAdapters: [],
      pluginBindings: [],
    });

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "persist_ops",
        title: "Onboarding persist test",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "wf_persist",
        parentExecutionId: null,
        agentId: "agent_onboard",
        roleId: "executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace_onboard_001",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        harnessRunId: null,
        budgetReservationId: null,
        budgetLedgerId: null,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const task = ctx.store.getTask(taskId);
    const exec = ctx.store.getExecution(executionId);

    assert.ok(task);
    assert.equal(task?.title, "Onboarding persist test");
    assert.ok(exec);
    assert.equal(exec?.taskId, taskId);
    assert.equal(exec?.workflowId, "wf_persist");

    const onboarding = new DomainOnboardingService(registry);
    onboarding.start("persist_test");
    assert.ok(onboarding.get("persist_test"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
