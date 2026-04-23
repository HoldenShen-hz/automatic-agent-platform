import assert from "node:assert/strict";
import test from "node:test";
import { CODING_DOMAIN_PRESET, requiresCodingReview } from "../../../src/domains/coding/index.js";
import { listBlockingEvaluators } from "../../../src/domains/eval-framework/index.js";
import { isCrossDomainInteractionAllowed } from "../../../src/domains/interaction-policy/index.js";
import { resolveKnowledgeNamespaces } from "../../../src/domains/knowledge-schema/index.js";
import { nextOnboardingPhase } from "../../../src/domains/operations/index.js";
import { resolvePromptTemplate } from "../../../src/domains/prompt-library/index.js";
import { matchDomainRecipe } from "../../../src/domains/recipes/index.js";
import { computeDomainRiskLevel } from "../../../src/domains/risk-profile/index.js";
test("domain support modules expose contract-aligned helpers", () => {
    assert.equal(CODING_DOMAIN_PRESET.domainId, "coding");
    assert.equal(requiresCodingReview("implement"), true);
    assert.equal(requiresCodingReview("analyze"), false);
    assert.equal(computeDomainRiskLevel({
        profileId: "risk_1",
        domainId: "coding",
        defaultRiskLevel: "low",
        dimensions: [],
    }, 72), "high");
    assert.deepEqual(resolveKnowledgeNamespaces({
        schemaId: "knowledge_1",
        domainId: "coding",
        namespaceIds: ["repo", "tickets"],
        freshnessWindowHours: 24,
        conflictResolution: "trust_priority",
        retentionDays: 30,
        knowledgeSources: [],
        retrievalStrategy: { strategy: "semantic", maxResults: 10, minRelevanceScore: 0.7, rerankEnabled: false },
        freshnessPolicy: { maxStalenessHours: 24, refreshTrigger: "scheduled", backgroundRefreshEnabled: true },
    }, ["tickets", "runbooks"]), ["repo", "tickets", "runbooks"]);
    assert.equal(listBlockingEvaluators({
        frameworkId: "eval_1",
        domainId: "coding",
        fewShotExamples: [],
        evaluators: [
            { evaluatorId: "tests", metric: "pass_rate", threshold: 0.95, blocking: true },
            { evaluatorId: "style", metric: "lint", threshold: 0.9, blocking: false },
        ],
        onlineMetrics: [],
        releaseGates: { minFewShotCount: 5, minRegressionCaseCount: 20, requirePromptInjectionCoverage: true },
    }).length, 1);
    assert.equal(resolvePromptTemplate({
        libraryId: "prompts_1",
        domainId: "coding",
        prompts: [
            { promptId: "plan", stage: "plan", version: "1.0.0", template: "Build a plan", guardrails: [] },
        ],
    }, "plan")?.template, "Build a plan");
    assert.equal(matchDomainRecipe([
        { recipeId: "release", domainId: "coding", triggerPhrases: ["release", "deploy"], defaultWorkflowId: "wf_release", defaultToolBundleIds: ["repo_tools"] },
    ], "Please prepare a release checklist")?.recipeId, "release");
    assert.equal(isCrossDomainInteractionAllowed([
        { sourceDomainId: "coding", targetDomainId: "operations", mode: "allow", maxConcurrentWorkflows: 2, compensationRequired: false },
    ], "coding", "operations"), true);
    assert.equal(nextOnboardingPhase("security_certification"), "canary_launch");
});
//# sourceMappingURL=domain-contract-support.test.js.map