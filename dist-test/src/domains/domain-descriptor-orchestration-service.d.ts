import { type DomainEvalFramework } from "./eval-framework/index.js";
import { type DomainInteractionRule } from "./interaction-policy/index.js";
import { type DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import { type DomainOnboardingPhase } from "./operations/index.js";
import { type DomainPromptLibrary } from "./prompt-library/index.js";
import { type DomainRecipe } from "./recipes/index.js";
import { type DomainRiskProfile } from "./risk-profile/index.js";
export interface DomainDescriptorInput {
    readonly domainId: string;
    readonly displayName: string;
    readonly description: string;
    readonly ownerOrgNodeId: string;
    readonly lifecycleState: "draft" | "validating" | "certified" | "canary" | "active" | "deprecated" | "retired";
    readonly version: number;
    readonly riskProfile: DomainRiskProfile;
    readonly knowledgeSchema: DomainKnowledgeSchema;
    readonly evalFramework: DomainEvalFramework;
    readonly promptLibrary: DomainPromptLibrary;
    readonly recipes: readonly DomainRecipe[];
    readonly interactionRules?: readonly DomainInteractionRule[];
    readonly defaultToolBundleIds: readonly string[];
    readonly defaultWorkflowIds: readonly string[];
    readonly metaModelCompleteness?: number;
    readonly metaModelMissingQuestionIds?: readonly string[];
}
export interface DomainDescriptorReview {
    readonly domainId: string;
    readonly lifecycleState: DomainDescriptorInput["lifecycleState"];
    readonly ownerOrgNodeId: string;
    readonly blockingEvaluatorIds: readonly string[];
    readonly promptIds: readonly string[];
    readonly promptStageCoverage: readonly string[];
    readonly recipeIds: readonly string[];
    readonly defaultKnowledgeNamespaces: readonly string[];
    readonly crossDomainModes: Readonly<Record<string, DomainInteractionRule["mode"]>>;
    readonly reviewRequiredTaskTypes: readonly string[];
    readonly metaModelCompleteness: number;
    readonly metaModelMissingQuestionIds: readonly string[];
    readonly onboardingReadiness: "ready" | "needs_evidence" | "blocked";
    readonly findings: readonly string[];
}
export interface DomainOnboardingChecklist {
    readonly domainId: string;
    readonly phases: readonly {
        readonly phase: DomainOnboardingPhase;
        readonly requiredEvidence: readonly string[];
    }[];
}
export declare class DomainDescriptorOrchestrationService {
    review(input: DomainDescriptorInput): DomainDescriptorReview;
    buildOnboardingChecklist(domainId: string): DomainOnboardingChecklist;
}
