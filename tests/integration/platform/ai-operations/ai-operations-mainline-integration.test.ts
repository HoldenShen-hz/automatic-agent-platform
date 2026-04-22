import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import { registerAiOperationsRuntimeOrchestrator } from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { PromptTemplateRegistryService } from "../../../../src/platform/prompt-engine/registry/index.js";
import { PromptRendererService } from "../../../../src/platform/prompt-engine/renderer/index.js";
import { PromptRolloutService } from "../../../../src/platform/prompt-engine/rollout/index.js";
import { PlatformPromptReleaseOrchestrationService } from "../../../../src/platform/prompt-engine/rollout/platform-prompt-release-orchestration-service.js";
import { EvalDatasetJudgeService } from "../../../../src/platform/prompt-engine/eval/eval-dataset-judge-service.js";
import { LlmEvalService } from "../../../../src/platform/prompt-engine/eval/llm-eval-service.js";
import { PromptModelPolicyGovernanceService } from "../../../../src/platform/prompt-engine/eval/prompt-model-policy-governance-service.js";
import { ModelRoutingService } from "../../../../src/platform/model-gateway/provider-registry/model-routing-service.js";
import { BudgetGuard } from "../../../../src/platform/model-gateway/cost-tracker/index.js";
import { estimateTextTokens } from "../../../../src/platform/model-gateway/messages/index.js";
import { ComplianceCaseOrchestrationService } from "../../../../src/platform/compliance/compliance-case-orchestration-service.js";
import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../src/platform/orchestration/harness/index.js";

test("integration: ai operations mainline composes prompt governance, model rollback, compliance evidence, and harness runtime", async () => {
  const registry = ServiceRegistry.getInstance();
  const ctx = createIntegrationContext("aa-aiops-mainline-");

  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const startup = orchestrator.startup();
    assert.equal(startup.ready, true);
    assert.deepEqual(startup.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);

    const templates = new PromptTemplateRegistryService();
    const renderer = new PromptRendererService();
    const rollouts = new PromptRolloutService();
    const datasetJudge = new EvalDatasetJudgeService();

    datasetJudge.registerDataset({
      datasetId: "dataset_aiops_release",
      name: "AI Ops Release",
      version: "2026.04.22",
      stage: "assess",
      createdBy: "quality",
      cases: [
        {
          caseId: "explain_rollback",
          input: { request: "explain rollback plan" },
          expectedOutput: "rollback evidence",
          tags: ["rollback", "evidence"],
          priority: "critical",
          qualityCriteria: [
            {
              criterionId: "contains_rollback",
              type: "contains",
              config: { substring: "rollback evidence" },
              weight: 1,
              threshold: 1,
            },
          ],
        },
      ],
    });
    datasetJudge.activateDataset("dataset_aiops_release");

    const promptRelease = new PlatformPromptReleaseOrchestrationService(
      templates,
      datasetJudge,
      rollouts,
    ).createRelease({
      template: {
        templateKey: "aiops_release_guardrail",
        version: "v2026.04.22",
        owner: "ops@example.com",
        fixedPrefix: "Always preserve rollback evidence and compliance lineage.",
        domainBlock: "AI operations governance",
        variableSuffixTemplate: "Task: {{task}}",
        variableSpecs: [{ key: "task", required: true }],
      },
      datasetId: "dataset_aiops_release",
      candidateProvider: "openai",
      candidateProviderFamily: "openai",
      candidateModel: "gpt-ops-primary",
      owner: "ops@example.com",
      mode: "shadow",
      domainBlockCompatible: true,
      autoActivate: true,
      results: [
        {
          caseId: "explain_rollback",
          output: "rollback evidence with compliance lineage",
          latencyMs: 85,
          costUsd: 0.004,
        },
      ],
    });

    assert.equal(promptRelease.rollout.status, "active");

    const evalService = new LlmEvalService(ctx.db);
    const suite = evalService.defineSuite({
      name: "AI ops model gate",
      kind: "regression",
      description: "Gate degraded models before production routing.",
      cases: [
        { id: "safe_case", input: "safe", expectedOutput: "safe" },
        { id: "degraded_case", input: "degraded", expectedOutput: "needs_fallback" },
      ],
    });
    const governance = new PromptModelPolicyGovernanceService(ctx.db, evalService);
    const modelRelease = governance.registerModelRelease({
      profileName: "ops_primary",
      version: "2026.04.22-primary",
      owner: "mlops@example.com",
      frozenModelId: "gpt-ops-primary",
      fallbackProfiles: ["ops_fallback"],
      rollbackProfileName: "ops_fallback",
      reviewRequired: false,
      rolloutScope: "canary",
      evaluationSuiteId: suite.id,
    });
    const gate = governance.evaluateReleaseGate({
      releaseId: modelRelease.id,
      modelId: "gpt-ops-primary",
      promptVersion: promptRelease.template.version,
      passingVerdicts: ["pass"],
      evaluator: ({ caseDefinition }) => ({
        actualOutput: caseDefinition.id === "safe_case" ? "safe" : "needs_review",
        score: caseDefinition.id === "safe_case" ? 0.98 : 0.45,
        passed: caseDefinition.id === "safe_case",
        latencyMs: 90,
      }),
    });

    assert.equal(gate.event.decision, "degrade_to_fallback");
    assert.equal(gate.release.status, "blocked");

    const routing = new ModelRoutingService({
      registry: {
        version: "test",
        providers: {
          openai: { status: "active", authMethods: ["api_key"] },
        },
        profiles: {
          ops_primary: {
            provider: "openai",
            modelId: "gpt-ops-primary",
            tier: "reasoning",
            capabilities: ["function_calling", "json_mode"],
            contextWindowTokens: 128000,
            maxOutputTokens: 4096,
            pricing: { inputPer1kUsd: 0.02, outputPer1kUsd: 0.04 },
            metadataSource: "local_override",
          },
          ops_fallback: {
            provider: "openai",
            modelId: "gpt-ops-fallback",
            tier: "balanced",
            capabilities: ["function_calling", "json_mode"],
            contextWindowTokens: 64000,
            maxOutputTokens: 4096,
            pricing: { inputPer1kUsd: 0.008, outputPer1kUsd: 0.016 },
            metadataSource: "local_override",
          },
        },
      },
      providerHealth: {
        openai: {
          status: "healthy",
          successRate: 1,
          totalCalls: 25,
          failedCalls: 0,
          fallbackCount: 0,
          latestFailureCodes: [],
        },
      },
    });
    const route = routing.route({
      routeClass: "reasoning",
      riskLevel: "high",
      preferredProfileName: "ops_primary",
      requiredCapabilities: ["function_calling"],
      governanceSnapshot: governance.buildModelGovernanceSnapshot(),
    });

    assert.equal(route.profileName, "ops_fallback");
    assert.equal(route.trace.routeReason, "governance_fallback");

    const rendered = renderer.render({
      template: promptRelease.template,
      variables: { task: "prepare privacy-safe rollback response" },
    });
    const estimatedTokens = estimateTextTokens(rendered.prompt);
    assert.ok(estimatedTokens > 0);

    const budget = new BudgetGuard().evaluateTaskSpend({
      policy: {
        maxTaskCostUsd: 5,
        maxDailyCostUsd: 50,
        maxMonthlyCostUsd: 500,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      currentTaskCostUsd: 1.2,
      nextEstimatedCostUsd: 0.4,
    });
    assert.equal(budget.allowed, true);

    const compliance = new ComplianceCaseOrchestrationService({
      classification: new DataClassificationService({ strictMode: true }),
      governance: new ComplianceGovernanceService(
        [
          {
            orgNodeId: "root",
            nodeType: "company",
            displayName: "Root",
            parentOrgNodeId: null,
            ownerUserIds: ["ceo"],
            active: true,
            metadata: {},
            costCenter: "",
          },
          {
            orgNodeId: "dept_ops",
            nodeType: "department",
            displayName: "Ops",
            parentOrgNodeId: "root",
            ownerUserIds: ["ops_lead"],
            active: true,
            metadata: {},
            costCenter: "OPS-001",
          },
        ],
        {
          root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
          dept_ops: [{ policyId: "ops_policy", rules: { approvalRequired: true, residencyReview: true } }],
        },
      ),
    });
    const transfer = compliance.prepareCrossRegionArtifactTransfer({
      actorId: "ops_lead",
      orgNodeId: "dept_ops",
      action: "aiops.release_export",
      tenantId: "tenant-aiops",
      sourceRegion: "cn-shanghai",
      targetRegion: "cn-beijing",
      policy: {
        tenantId: "tenant-aiops",
        allowedRegions: ["cn-beijing"],
        restrictedClassifications: ["confidential", "restricted"],
        allowRedactedTransfer: true,
      },
      content: "rollback evidence for alice@example.com requires export review",
      artifactRef: "artifact:release-note",
      exportRef: "artifact:release-note-export",
      record: { payload: { ownerEmail: "alice@example.com" } },
      encryptionRules: [{ fieldPath: "payload.ownerEmail", classification: "restricted" }],
      keyRef: "kms://tenant-aiops/release-key",
      requiredPolicyKeys: ["approvalRequired"],
      allowRedactedRestrictedTransfer: true,
    });

    assert.equal(transfer.status, "approved");
    assert.ok(transfer.lineageEdges.length >= 2);

    const constraintPack: ConstraintPack = {
      policyIds: ["prompt_release", "model_governance", "compliance_transfer"],
      approvalMode: budget.requiresApproval ? "required" : "supervised",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["knowledge.query", "artifact.publish"] },
      risk_policy: {
        maxRiskScore: 70,
        escalationThreshold: 55,
      },
      output_policy: {
        requiredEvidence: ["risk_profile", "eval_framework"],
        redactSensitiveData: true,
      },
      budget: {
        maxSteps: 6,
        maxCost: Number((budget.remainingBudgetUsd + 1.2).toFixed(2)),
        maxDurationMs: 20_000,
      },
    };
    const harnessRun = new HarnessRuntimeService().runLoop({
      taskId: "task_aiops_release",
      domainId: "operations",
      constraintPack,
      plannerOutput: {
        selectedProfile: route.profileName,
        promptVersion: promptRelease.template.version,
        rolloutId: promptRelease.rollout.rolloutId,
      },
      generatorOutput: {
        renderedPrompt: rendered.prompt,
        selectedModelId: route.profile.modelId,
        evidenceRefs: transfer.lineageEdges.map((edge) => edge.edgeId),
        estimatedTokens,
      },
      evaluatorOutput: {
        releaseDecision: gate.event.decision,
        transferStatus: transfer.status,
        fallbackProfile: route.profileName,
      },
      evaluatorScore: 0.86,
    });

    assert.equal(harnessRun.status, "completed");
    assert.equal(harnessRun.decision?.action, "accept");
    assert.deepEqual(
      harnessRun.steps.map((step) => step.role),
      ["planner", "generator", "evaluator"],
    );
  } finally {
    ctx.cleanup();
    await registry.reset();
  }
});
