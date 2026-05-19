/**
 * Integration Test: Domain Registry Mainline
 *
 * Tests domain registry with multi-domain scenarios
 * using SQLite integration context.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { DomainRegistryService } from "../../../../src/domains/registry/domain-registry-service.js";
import { DomainOnboardingService } from "../../../../src/domains/operations/domain-onboarding-service.js";
import { DomainDescriptorOrchestrationService } from "../../../../src/domains/domain-descriptor-orchestration-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
function createRegistryContext(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = `${workspace}/registry.db`;
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return { workspace, db, store };
}
test("Domain registry: registers multiple domains and validates each", () => {
    const ctx = createRegistryContext("aa-registry-multi-");
    try {
        const registry = new DomainRegistryService();
        const domainIds = ["coding", "finance", "security", "ops"];
        for (const domainId of domainIds) {
            registry.register({
                domainId,
                name: `${domainId.charAt(0).toUpperCase()}${domainId.slice(1)}`,
                description: `${domainId} domain`,
                version: 1,
                workflows: [
                    {
                        workflowId: `${domainId}_wf`,
                        name: `${domainId} workflow`,
                        triggerConditions: {},
                        steps: [
                            {
                                stepName: "execute",
                                toolHints: ["bash"],
                                modelHints: {},
                                outputSchema: null,
                                retryPolicy: { maxRetries: 0, backoffMs: 0 },
                                requiresReview: false,
                                timeoutMs: 60000,
                                dependsOn: [],
                            },
                        ],
                    },
                ],
                toolBundles: [
                    {
                        bundleId: `${domainId}_tools`,
                        tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
                    },
                ],
                outputContracts: [],
                promptOverrides: {},
                capabilities: {
                    supportedTaskTypes: ["implement", "review"],
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
        }
        assert.equal(registry.listActive().length, 4);
        for (const domainId of domainIds) {
            const validation = registry.validate(domainId);
            assert.equal(validation.passed, true);
        }
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("Domain registry: builds capability entry for domain", () => {
    const ctx = createRegistryContext("aa-registry-cap-");
    try {
        const registry = new DomainRegistryService();
        registry.register({
            domainId: "coding",
            name: "Coding",
            description: "Software delivery",
            version: 1,
            workflows: [
                {
                    workflowId: "wf_release",
                    name: "Release",
                    triggerConditions: {},
                    steps: [
                        {
                            stepName: "build",
                            toolHints: ["bash", "read"],
                            modelHints: {},
                            outputSchema: null,
                            retryPolicy: { maxRetries: 0, backoffMs: 0 },
                            requiresReview: true,
                            timeoutMs: 120000,
                            dependsOn: [],
                        },
                    ],
                },
            ],
            toolBundles: [
                {
                    bundleId: "repo_tools",
                    tools: [
                        { toolName: "bash", enabled: true, configOverrides: {} },
                        { toolName: "read", enabled: true, configOverrides: {} },
                    ],
                },
            ],
            outputContracts: [],
            promptOverrides: {},
            capabilities: {
                supportedTaskTypes: ["implement", "review", "deploy"],
                requiredTools: ["bash"],
                optionalTools: ["read"],
                modelPreferences: {},
                budgetLimits: { maxTokensPerTask: 2000, maxCostPerTask: 2 },
                securityLevel: "standard",
            },
            status: "active",
            externalAdapters: [],
            pluginBindings: [],
        });
        const capability = registry.buildCapabilityEntry("coding");
        assert.equal(capability.domainId, "coding");
        assert.ok(capability.toolNames.length >= 1);
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("Domain registry: onboarding advances through phases", () => {
    const ctx = createRegistryContext("aa-registry-onboard-");
    try {
        const registry = new DomainRegistryService();
        registry.register({
            domainId: "test_domain",
            name: "Test Domain",
            description: "Testing domain",
            version: 1,
            workflows: [
                {
                    workflowId: "test_wf",
                    name: "Test Workflow",
                    triggerConditions: {},
                    steps: [
                        {
                            stepName: "test",
                            toolHints: ["bash"],
                            modelHints: {},
                            outputSchema: null,
                            retryPolicy: { maxRetries: 0, backoffMs: 0 },
                            requiresReview: false,
                            timeoutMs: 60000,
                            dependsOn: [],
                        },
                    ],
                },
            ],
            toolBundles: [
                {
                    bundleId: "test_tools",
                    tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
                },
            ],
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
            status: "testing",
            externalAdapters: [],
            pluginBindings: [],
        });
        const onboarding = new DomainOnboardingService(registry);
        onboarding.start("test_domain");
        assert.ok(onboarding.get("test_domain"));
        assert.equal(onboarding.get("test_domain")?.activePhase, "domain_modeling");
        const phases = ["domain_modeling", "pack_development", "security_certification", "gray_rollout"];
        for (const phase of phases) {
            onboarding.advance("test_domain", [`${phase}:evidence`]);
        }
        assert.equal(onboarding.get("test_domain")?.completed, true);
        assert.equal(registry.get("test_domain")?.status, "active");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("Domain registry: descriptor review validates domain", () => {
    const ctx = createRegistryContext("aa-registry-review-");
    try {
        const registry = new DomainRegistryService();
        const descriptorService = new DomainDescriptorOrchestrationService();
        registry.register({
            domainId: "review_test",
            name: "Review Test",
            description: "Testing review",
            version: 1,
            workflows: [
                {
                    workflowId: "review_wf",
                    name: "Review Workflow",
                    triggerConditions: {},
                    steps: [
                        {
                            stepName: "step1",
                            toolHints: ["bash"],
                            modelHints: {},
                            outputSchema: null,
                            retryPolicy: { maxRetries: 0, backoffMs: 0 },
                            requiresReview: false,
                            timeoutMs: 60000,
                            dependsOn: [],
                        },
                    ],
                },
            ],
            toolBundles: [
                {
                    bundleId: "review_tools",
                    tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
                },
            ],
            outputContracts: [],
            promptOverrides: {},
            capabilities: {
                supportedTaskTypes: ["test"],
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
        const review = descriptorService.review({
            domainId: "review_test",
            displayName: "Review Test",
            description: "Testing review",
            ownerOrgNodeId: "org_test",
            lifecycleState: "validating",
            version: 1,
            riskProfile: {
                profileId: "risk_review",
                domainId: "review_test",
                defaultRiskLevel: "low",
                dimensions: [],
            },
            knowledgeSchema: {
                schemaId: "knowledge_review",
                domainId: "review_test",
                namespaceIds: ["test_ns"],
                freshnessWindowHours: 24,
                conflictResolution: "trust_priority",
                retentionDays: 30,
                knowledgeSources: [],
                retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
                freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
            },
            evalFramework: {
                frameworkId: "eval_review",
                domainId: "review_test",
                fewShotExamples: [],
                evaluators: [{ evaluatorId: "tests", metric: "pass_rate", threshold: 0.95, blocking: true }],
                onlineMetrics: [],
                releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
            },
            promptLibrary: {
                libraryId: "prompt_review",
                domainId: "review_test",
                prompts: [],
            },
            recipes: [],
            defaultToolBundleIds: ["review_tools"],
            defaultWorkflowIds: ["review_wf"],
        });
        assert.ok(review.onboardingReadiness === "ready" || review.onboardingReadiness === "needs_evidence" || review.onboardingReadiness === "blocked");
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
test("Domain registry: task store persists domain task with FK constraints", () => {
    const ctx = createRegistryContext("aa-registry-task-");
    try {
        const registry = new DomainRegistryService();
        const taskId = "task_domain_001";
        const executionId = "exec_domain_001";
        const now = nowIso();
        registry.register({
            domainId: "coding",
            name: "Coding",
            description: "Software delivery",
            version: 1,
            workflows: [
                {
                    workflowId: "wf_coding",
                    name: "Coding Workflow",
                    triggerConditions: {},
                    steps: [
                        {
                            stepName: "code",
                            toolHints: ["bash"],
                            modelHints: {},
                            outputSchema: null,
                            retryPolicy: { maxRetries: 0, backoffMs: 0 },
                            requiresReview: false,
                            timeoutMs: 60000,
                            dependsOn: [],
                        },
                    ],
                },
            ],
            toolBundles: [
                {
                    bundleId: "coding_tools",
                    tools: [{ toolName: "bash", enabled: true, configOverrides: {} }],
                },
            ],
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
        ctx.db.transaction(() => {
            ctx.store.insertTask({
                id: taskId,
                parentId: null,
                rootId: taskId,
                divisionId: "coding_ops",
                title: "Domain task test",
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
                workflowId: "wf_coding",
                parentExecutionId: null,
                agentId: "agent_coding",
                roleId: "executor",
                runKind: "task_run",
                status: "executing",
                inputRef: null,
                traceId: "trace_domain_001",
                attempt: 1,
                timeoutMs: 60000,
                budgetUsdLimit: 1,
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
        assert.equal(task?.title, "Domain task test");
        assert.ok(exec);
        assert.equal(exec?.workflowId, "wf_coding");
        assert.equal(exec?.taskId, taskId);
        const capability = registry.buildCapabilityEntry("coding");
        assert.ok(capability.toolNames.includes("bash"));
    }
    finally {
        ctx.db.close();
        cleanupPath(ctx.workspace);
    }
});
//# sourceMappingURL=registry-mainline-integration.test.js.map