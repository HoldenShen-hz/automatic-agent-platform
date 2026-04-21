import { type CodingTaskType } from "./coding/index.js";
import { type DomainEvalFramework } from "./eval-framework/index.js";
import { type DomainInteractionRule } from "./interaction-policy/index.js";
import { type DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import { type DomainPromptLibrary, type DomainPromptTemplate } from "./prompt-library/index.js";
import { type DomainRecipe } from "./recipes/index.js";
import { type DomainRiskProfile } from "./risk-profile/index.js";
export interface DomainTaskDesignRequest {
    readonly domainId: string;
    readonly taskType: CodingTaskType | string;
    readonly userInput: string;
    readonly promptId: string;
    readonly riskScore: number;
    readonly additionalNamespaceIds?: readonly string[];
    readonly targetDomainId?: string | null;
}
export interface DomainTaskDesign {
    readonly domainId: string;
    readonly taskType: string;
    readonly recipeId: string | null;
    readonly workflowId: string | null;
    readonly prompt: DomainPromptTemplate | null;
    readonly riskLevel: string;
    readonly reviewRequired: boolean;
    readonly blockingEvaluatorIds: readonly string[];
    readonly knowledgeNamespaces: readonly string[];
    readonly interactionMode: "allow" | "approval_required" | "deny" | "same_domain";
    readonly decisionSummary: readonly string[];
}
export interface DomainTaskDesignServiceOptions {
    readonly recipes: readonly DomainRecipe[];
    readonly promptLibrary: DomainPromptLibrary;
    readonly riskProfile: DomainRiskProfile;
    readonly evalFramework: DomainEvalFramework;
    readonly knowledgeSchema: DomainKnowledgeSchema;
    readonly interactionRules?: readonly DomainInteractionRule[];
}
export declare class DomainTaskDesignService {
    private readonly options;
    private readonly interactionRules;
    constructor(options: DomainTaskDesignServiceOptions);
    design(request: DomainTaskDesignRequest): DomainTaskDesign;
    private resolveInteractionMode;
    private isCodingTaskType;
}
