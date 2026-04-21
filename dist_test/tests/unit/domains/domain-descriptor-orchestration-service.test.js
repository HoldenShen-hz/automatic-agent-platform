import assert from "node:assert/strict";
import test from "node:test";
import { DomainDescriptorOrchestrationService } from "../../../src/domains/domain-descriptor-orchestration-service.js";
test("DomainDescriptorOrchestrationService summarizes descriptor readiness and review requirements", () => {
    const service = new DomainDescriptorOrchestrationService();
    const review = service.review({
        domainId: "coding",
        displayName: "Coding",
        description: "Software delivery",
        ownerOrgNodeId: "org_eng",
        lifecycleState: "canary",
        version: 2,
        riskProfile: {
            profileId: "risk_coding",
            domainId: "coding",
            defaultRiskLevel: "high",
            dimensions: [],
        },
        knowledgeSchema: {
            schemaId: "knowledge_coding",
            domainId: "coding",
            namespaceIds: ["repo", "runbooks"],
            freshnessWindowHours: 24,
            conflictResolution: "trust_priority",
            retentionDays: 30,
            knowledgeSources: [],
            retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
            freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
        },
        evalFramework: {
            frameworkId: "eval_coding",
            domainId: "coding",
            evaluators: [
                { evaluatorId: "tests", metric: "pass_rate", threshold: 0.95, blocking: true },
            ],
            onlineMetrics: ["latency"],
        },
        promptLibrary: {
            libraryId: "prompt_coding",
            domainId: "coding",
            prompts: [
                { promptId: "plan", stage: "plan", version: "1.0", template: "Plan", guardrails: [] },
                { promptId: "execute", stage: "execute", version: "1.0", template: "Execute", guardrails: ["approval_required"] },
            ],
        },
        recipes: [
            {
                recipeId: "release",
                domainId: "coding",
                triggerPhrases: ["release"],
                defaultWorkflowId: "wf_release",
                defaultToolBundleIds: ["repo_tools"],
            },
        ],
        interactionRules: [
            {
                sourceDomainId: "coding",
                targetDomainId: "operations",
                mode: "approval_required",
                maxConcurrentWorkflows: 1,
                compensationRequired: true,
            },
        ],
        defaultToolBundleIds: ["repo_tools"],
        defaultWorkflowIds: ["wf_release"],
    });
    assert.equal(review.onboardingReadiness, "ready");
    assert.deepEqual(review.reviewRequiredTaskTypes, ["implement", "release"]);
    assert.deepEqual(review.defaultKnowledgeNamespaces, ["repo", "runbooks"]);
    assert.equal(review.crossDomainModes["coding->operations"], "approval_required");
});
test("DomainDescriptorOrchestrationService flags missing authoritative inputs", () => {
    const service = new DomainDescriptorOrchestrationService();
    const review = service.review({
        domainId: "ops",
        displayName: "Ops",
        description: "Operations",
        ownerOrgNodeId: "org_ops",
        lifecycleState: "draft",
        version: 1,
        riskProfile: {
            profileId: "risk_ops",
            domainId: "ops",
            defaultRiskLevel: "low",
            dimensions: [],
        },
        knowledgeSchema: {
            schemaId: "knowledge_ops",
            domainId: "ops",
            namespaceIds: [],
            freshnessWindowHours: 24,
            conflictResolution: "latest_wins",
            retentionDays: 30,
            knowledgeSources: [],
            retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
            freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
        },
        evalFramework: {
            frameworkId: "eval_ops",
            domainId: "ops",
            evaluators: [],
            onlineMetrics: [],
        },
        promptLibrary: {
            libraryId: "prompt_ops",
            domainId: "ops",
            prompts: [],
        },
        recipes: [],
        defaultToolBundleIds: [],
        defaultWorkflowIds: [],
    });
    assert.equal(review.onboardingReadiness, "needs_evidence");
    assert.ok(review.findings.includes("domain_descriptor.default_workflow_missing"));
    assert.ok(review.findings.includes("domain_descriptor.blocking_evaluator_missing"));
});
//# sourceMappingURL=domain-descriptor-orchestration-service.test.js.map