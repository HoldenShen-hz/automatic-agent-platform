import assert from "node:assert/strict";
import test from "node:test";
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
import { HarnessRuntimeService } from "../../../../src/platform/orchestration/harness/index.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
test("integration: ai operations coverage tests model routing fallback triggered by governance decision", () => {
    const registry = ServiceRegistry.getInstance();
    const ctx = createIntegrationContext("aa-aiops-coverage-");
    try {
        const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
        const startup = orchestrator.startup();
        assert.equal(startup.ready, true);
        const evalService = new LlmEvalService(ctx.db);
        const suite = evalService.defineSuite({
            name: "routing fallback suite",
            kind: "regression",
            description: "Test governance-triggered fallback routing",
            cases: [
                { id: "pass_case", input: "safe input", expectedOutput: "safe output" },
                { id: "fail_case", input: "degraded input", expectedOutput: "fallback needed" },
            ],
        });
        const governance = new PromptModelPolicyGovernanceService(ctx.db, evalService);
        const modelRelease = governance.registerModelRelease({
            profileName: "coverage_primary",
            version: "2026.04.23-coverage",
            owner: "coverage@example.com",
            frozenModelId: "gpt-coverage-primary",
            fallbackProfiles: ["coverage_fallback"],
            rollbackProfileName: "coverage_fallback",
            reviewRequired: false,
            rolloutScope: "canary",
            evaluationSuiteId: suite.id,
        });
        const gate = governance.evaluateReleaseGate({
            releaseId: modelRelease.id,
            modelId: "gpt-coverage-primary",
            promptVersion: "v2026.04.23",
            passingVerdicts: ["pass"],
            evaluator: ({ caseDefinition }) => ({
                actualOutput: caseDefinition.id === "pass_case" ? "safe output" : "needs_review",
                score: caseDefinition.id === "pass_case" ? 0.98 : 0.4,
                passed: caseDefinition.id === "pass_case",
                latencyMs: 50,
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
                    coverage_primary: {
                        provider: "openai",
                        modelId: "gpt-coverage-primary",
                        tier: "reasoning",
                        capabilities: ["function_calling", "json_mode"],
                        contextWindowTokens: 128000,
                        maxOutputTokens: 4096,
                        pricing: { inputPer1kUsd: 0.02, outputPer1kUsd: 0.04 },
                        metadataSource: "local_override",
                    },
                    coverage_fallback: {
                        provider: "openai",
                        modelId: "gpt-coverage-fallback",
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
                    totalCalls: 10,
                    failedCalls: 0,
                    fallbackCount: 0,
                    latestFailureCodes: [],
                },
            },
        });
        const route = routing.route({
            routeClass: "reasoning",
            riskLevel: "high",
            preferredProfileName: "coverage_primary",
            requiredCapabilities: ["function_calling"],
            governanceSnapshot: governance.buildModelGovernanceSnapshot(),
        });
        assert.equal(route.profileName, "coverage_fallback");
        assert.equal(route.trace.routeReason, "governance_fallback");
    }
    finally {
        ctx.cleanup();
        registry.reset();
    }
});
test("integration: ai operations coverage tests prompt rendering with budget guard evaluation", () => {
    const ctx = createIntegrationContext("aa-aiops-coverage-render-");
    try {
        const templates = new PromptTemplateRegistryService();
        const renderer = new PromptRendererService();
        const rollouts = new PromptRolloutService();
        const datasetJudge = new EvalDatasetJudgeService();
        datasetJudge.registerDataset({
            datasetId: "dataset_render_coverage",
            name: "Render Coverage",
            version: "2026.04.23",
            stage: "assess",
            createdBy: "quality",
            cases: [
                {
                    caseId: "render_case",
                    input: { request: "test render" },
                    expectedOutput: "rendered output",
                    tags: ["render"],
                    priority: "critical",
                    qualityCriteria: [
                        {
                            criterionId: "render_ok",
                            type: "contains",
                            config: { substring: "rendered output" },
                            weight: 1,
                            threshold: 1,
                        },
                    ],
                },
            ],
        });
        datasetJudge.activateDataset("dataset_render_coverage");
        const promptRelease = new PlatformPromptReleaseOrchestrationService(templates, datasetJudge, rollouts).createRelease({
            template: {
                templateKey: "coverage_render_guardrail",
                version: "v2026.04.23",
                owner: "coverage@example.com",
                fixedPrefix: "Coverage test prefix.",
                domainBlock: "coverage governance",
                variableSuffixTemplate: "Task: {{task}}",
                variableSpecs: [{ key: "task", required: true }],
            },
            datasetId: "dataset_render_coverage",
            candidateProvider: "openai",
            candidateProviderFamily: "openai",
            candidateModel: "gpt-coverage-primary",
            owner: "coverage@example.com",
            mode: "shadow",
            domainBlockCompatible: true,
            autoActivate: true,
            results: [
                {
                    caseId: "render_case",
                    output: "rendered output",
                    latencyMs: 45,
                    costUsd: 0.002,
                },
            ],
        });
        assert.equal(promptRelease.rollout.status, "active");
        const rendered = renderer.render({
            template: promptRelease.template,
            variables: { task: "coverage render test" },
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
            currentTaskCostUsd: 0.5,
            nextEstimatedCostUsd: 0.3,
        });
        assert.equal(budget.allowed, true);
        assert.ok(budget.remainingBudgetUsd > 0);
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: ai operations coverage tests compliance cross-region artifact transfer", () => {
    const ctx = createIntegrationContext("aa-aiops-coverage-compliance-");
    try {
        const compliance = new ComplianceCaseOrchestrationService({
            classification: new DataClassificationService({ strictMode: true }),
            governance: new ComplianceGovernanceService([
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
                    orgNodeId: "dept_coverage",
                    nodeType: "department",
                    displayName: "Coverage",
                    parentOrgNodeId: "root",
                    ownerUserIds: ["coverage_lead"],
                    active: true,
                    metadata: {},
                    costCenter: "COV-001",
                },
            ], {
                root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
                dept_coverage: [{ policyId: "coverage_policy", rules: { approvalRequired: true, residencyReview: true } }],
            }),
        });
        const transfer = compliance.prepareCrossRegionArtifactTransfer({
            actorId: "coverage_lead",
            orgNodeId: "dept_coverage",
            action: "aiops.release_export",
            tenantId: "tenant-coverage",
            sourceRegion: "us-east-1",
            targetRegion: "us-west-2",
            policy: {
                tenantId: "tenant-coverage",
                allowedRegions: ["us-west-2"],
                restrictedClassifications: ["confidential", "restricted"],
                allowRedactedTransfer: true,
            },
            content: "coverage evidence for bob@example.com requires export review",
            artifactRef: "artifact:coverage-note",
            exportRef: "artifact:coverage-note-export",
            record: { payload: { ownerEmail: "bob@example.com" } },
            encryptionRules: [{ fieldPath: "payload.ownerEmail", classification: "restricted" }],
            keyRef: "kms://tenant-coverage/coverage-key",
            requiredPolicyKeys: ["approvalRequired"],
            allowRedactedRestrictedTransfer: true,
        });
        assert.equal(transfer.status, "approved");
        assert.ok(transfer.lineageEdges.length >= 2);
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: ai operations coverage tests harness runtime with constraint pack", () => {
    const ctx = createIntegrationContext("aa-aiops-coverage-harness-");
    try {
        const constraintPack = {
            policyIds: ["prompt_release", "model_governance", "compliance_transfer"],
            approvalMode: "supervised",
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
                maxCost: 5,
                maxDurationMs: 20_000,
            },
        };
        const harnessRun = new HarnessRuntimeService().runLoop({
            taskId: "task_coverage_harness",
            domainId: "coverage",
            constraintPack,
            plannerOutput: {
                selectedProfile: "coverage_primary",
                promptVersion: "v2026.04.23",
                rolloutId: "rollout_coverage_001",
            },
            generatorOutput: {
                renderedPrompt: "Coverage test prompt for harness validation",
                selectedModelId: "gpt-coverage-primary",
                evidenceRefs: ["evidence_1", "evidence_2"],
                estimatedTokens: 120,
            },
            evaluatorOutput: {
                releaseDecision: "degrade_to_fallback",
                transferStatus: "approved",
                fallbackProfile: "coverage_fallback",
            },
            evaluatorScore: 0.85,
            producedEvidenceRefs: ["risk_profile", "eval_framework", "evidence_1", "evidence_2"],
        });
        assert.equal(harnessRun.status, "completed");
        assert.equal(harnessRun.decision?.action, "accept");
        assert.deepEqual(harnessRun.steps.map((step) => step.role), ["planner", "generator", "evaluator"]);
    }
    finally {
        ctx.cleanup();
    }
});
test("integration: ai operations coverage tests readiness snapshot captures all capability states", () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
        orchestrator.startup();
        const snapshot = orchestrator.snapshotReadiness();
        assert.equal(snapshot.runtimeCatalogInitialized, true);
        assert.equal(snapshot.startupPlanInitialized, true);
        assert.equal(snapshot.orchestratorInitialized, true);
        assert.ok(snapshot.capabilityReadiness.length > 0);
        assert.ok(snapshot.capabilityReadiness.every((cap) => cap.stepId != null && cap.bootstrapServiceId != null && typeof cap.initialized === "boolean"));
    }
    finally {
        registry.reset();
    }
});
//# sourceMappingURL=ai-operations-coverage-integration.test.js.map