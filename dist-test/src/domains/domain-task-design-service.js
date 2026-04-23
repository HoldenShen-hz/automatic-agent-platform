import { CODING_DOMAIN_PRESET, requiresCodingReview } from "./coding/index.js";
import { listBlockingEvaluators } from "./eval-framework/index.js";
import { isCrossDomainInteractionAllowed, } from "./interaction-policy/index.js";
import { resolveKnowledgeNamespaces, } from "./knowledge-schema/index.js";
import { resolvePromptTemplate, } from "./prompt-library/index.js";
import { matchDomainRecipe } from "./recipes/index.js";
import { computeDomainRiskLevel } from "./risk-profile/index.js";
export class DomainTaskDesignService {
    options;
    interactionRules;
    constructor(options) {
        this.options = options;
        this.interactionRules = options.interactionRules ?? [];
    }
    design(request) {
        const recipe = matchDomainRecipe(this.options.recipes, request.userInput);
        const prompt = resolvePromptTemplate(this.options.promptLibrary, request.promptId);
        const riskLevel = computeDomainRiskLevel(this.options.riskProfile, request.riskScore);
        const blockingEvaluatorIds = listBlockingEvaluators(this.options.evalFramework)
            .map((item) => item.evaluatorId);
        const knowledgeNamespaces = resolveKnowledgeNamespaces(this.options.knowledgeSchema, request.additionalNamespaceIds ?? []);
        const interactionMode = this.resolveInteractionMode(request.domainId, request.targetDomainId ?? null);
        const reviewRequired = request.domainId === CODING_DOMAIN_PRESET.domainId
            && this.isCodingTaskType(request.taskType)
            ? requiresCodingReview(request.taskType)
            : riskLevel === "high" || riskLevel === "critical" || interactionMode === "approval_required";
        return {
            domainId: request.domainId,
            taskType: request.taskType,
            recipeId: recipe?.recipeId ?? null,
            workflowId: recipe?.defaultWorkflowId ?? null,
            prompt,
            riskLevel,
            reviewRequired,
            blockingEvaluatorIds,
            knowledgeNamespaces,
            interactionMode,
            decisionSummary: [
                `risk=${riskLevel}`,
                `workflow=${recipe?.defaultWorkflowId ?? "none"}`,
                `prompt=${prompt?.promptId ?? "none"}`,
                `interaction=${interactionMode}`,
            ],
        };
    }
    resolveInteractionMode(sourceDomainId, targetDomainId) {
        if (targetDomainId == null || targetDomainId === sourceDomainId) {
            return "same_domain";
        }
        if (isCrossDomainInteractionAllowed(this.interactionRules, sourceDomainId, targetDomainId)) {
            return "allow";
        }
        const matchedRule = this.interactionRules.find((item) => item.sourceDomainId === sourceDomainId && item.targetDomainId === targetDomainId);
        return matchedRule?.mode ?? "deny";
    }
    isCodingTaskType(taskType) {
        return ["analyze", "plan", "implement", "test", "review", "release"].includes(taskType);
    }
}
//# sourceMappingURL=domain-task-design-service.js.map