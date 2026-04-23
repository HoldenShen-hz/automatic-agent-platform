import { CODING_DOMAIN_PRESET, requiresCodingReview } from "./coding/index.js";
import { listBlockingEvaluators } from "./eval-framework/index.js";
import { resolveKnowledgeNamespaces } from "./knowledge-schema/index.js";
export class DomainDescriptorOrchestrationService {
    review(input) {
        const blockingEvaluatorIds = listBlockingEvaluators(input.evalFramework).map((item) => item.evaluatorId);
        const promptIds = input.promptLibrary.prompts.map((item) => item.promptId);
        const promptStageCoverage = [...new Set(input.promptLibrary.prompts.map((item) => item.stage))];
        const recipeIds = input.recipes.map((item) => item.recipeId);
        const defaultKnowledgeNamespaces = resolveKnowledgeNamespaces(input.knowledgeSchema);
        const crossDomainModes = Object.fromEntries((input.interactionRules ?? []).map((rule) => [`${rule.sourceDomainId}->${rule.targetDomainId}`, rule.mode]));
        const reviewRequiredTaskTypes = input.domainId === CODING_DOMAIN_PRESET.domainId
            ? CODING_DOMAIN_PRESET.reviewRequiredTaskTypes.filter((taskType) => requiresCodingReview(taskType))
            : input.riskProfile.defaultRiskLevel === "high" || input.riskProfile.defaultRiskLevel === "critical"
                ? ["release", "production_change"]
                : [];
        const metaModelCompleteness = input.metaModelCompleteness ?? 100;
        const metaModelMissingQuestionIds = [...(input.metaModelMissingQuestionIds ?? [])];
        const findings = [
            ...(input.defaultWorkflowIds.length === 0 ? ["domain_descriptor.default_workflow_missing"] : []),
            ...(input.defaultToolBundleIds.length === 0 ? ["domain_descriptor.default_tool_bundle_missing"] : []),
            ...(promptStageCoverage.length === 0 ? ["domain_descriptor.prompt_stage_missing"] : []),
            ...(blockingEvaluatorIds.length === 0 ? ["domain_descriptor.blocking_evaluator_missing"] : []),
            ...(defaultKnowledgeNamespaces.length === 0 ? ["domain_descriptor.knowledge_namespace_missing"] : []),
            ...(recipeIds.length === 0 ? ["domain_descriptor.recipe_missing"] : []),
            ...(metaModelCompleteness < 100 ? [`domain_descriptor.meta_model_incomplete:${metaModelCompleteness}`] : []),
            ...metaModelMissingQuestionIds.map((questionId) => `domain_descriptor.meta_model_missing:${questionId}`),
            ...(input.lifecycleState === "active" && input.riskProfile.defaultRiskLevel === "critical"
                ? ["domain_descriptor.high_risk_active_requires_canary_history"]
                : []),
        ];
        return {
            domainId: input.domainId,
            lifecycleState: input.lifecycleState,
            ownerOrgNodeId: input.ownerOrgNodeId,
            blockingEvaluatorIds,
            promptIds,
            promptStageCoverage,
            recipeIds,
            defaultKnowledgeNamespaces,
            crossDomainModes,
            reviewRequiredTaskTypes,
            metaModelCompleteness,
            metaModelMissingQuestionIds,
            onboardingReadiness: findings.length === 0
                ? "ready"
                : findings.some((item) => item.includes("missing"))
                    ? "needs_evidence"
                    : "blocked",
            findings,
        };
    }
    buildOnboardingChecklist(domainId) {
        return {
            domainId,
            phases: [
                {
                    phase: "modeling",
                    requiredEvidence: ["descriptor", "risk_profile", "knowledge_schema"],
                },
                {
                    phase: "development_validation",
                    requiredEvidence: ["workflow_validation", "eval_framework", "prompt_library"],
                },
                {
                    phase: "security_certification",
                    requiredEvidence: ["security_review", "interaction_policy", "approval_path"],
                },
                {
                    phase: "canary_launch",
                    requiredEvidence: ["canary_metrics", "rollback_plan", "operator_signoff"],
                },
            ],
        };
    }
}
//# sourceMappingURL=domain-descriptor-orchestration-service.js.map