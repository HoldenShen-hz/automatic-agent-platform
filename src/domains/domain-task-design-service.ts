import { CODING_DOMAIN_PRESET, type CodingTaskType, requiresCodingReview } from "./coding/index.js";
import { listBlockingEvaluators, type DomainEvalFramework } from "./eval-framework/index.js";
import {
  isCrossDomainInteractionAllowed,
  type DomainInteractionRule,
} from "./interaction-policy/index.js";
import {
  resolveKnowledgeNamespaces,
  type DomainKnowledgeSchema,
} from "./knowledge-schema/index.js";
import {
  resolvePromptTemplate,
  type DomainPromptLibrary,
  type DomainPromptTemplate,
} from "./prompt-library/index.js";
import { matchDomainRecipe, type DomainRecipe } from "./recipes/index.js";
import { computeDomainRiskLevel, type DomainRiskProfile } from "./risk-profile/index.js";

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

export class DomainTaskDesignService {
  private readonly interactionRules: readonly DomainInteractionRule[];

  public constructor(private readonly options: DomainTaskDesignServiceOptions) {
    this.interactionRules = options.interactionRules ?? [];
  }

  public design(request: DomainTaskDesignRequest): DomainTaskDesign {
    const recipe = matchDomainRecipe(this.options.recipes, request.userInput);
    const prompt = resolvePromptTemplate(this.options.promptLibrary, request.promptId);
    const riskLevel = computeDomainRiskLevel(this.options.riskProfile, request.riskScore);
    const blockingEvaluatorIds = listBlockingEvaluators(this.options.evalFramework)
      .map((item) => item.evaluatorId);
    const knowledgeNamespaces = resolveKnowledgeNamespaces(
      this.options.knowledgeSchema,
      request.additionalNamespaceIds ?? [],
    );
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

  private resolveInteractionMode(sourceDomainId: string, targetDomainId: string | null): DomainTaskDesign["interactionMode"] {
    if (targetDomainId == null || targetDomainId === sourceDomainId) {
      return "same_domain";
    }
    if (isCrossDomainInteractionAllowed(this.interactionRules, sourceDomainId, targetDomainId)) {
      return "allow";
    }
    const matchedRule = this.interactionRules.find((item) =>
      item.sourceDomainId === sourceDomainId && item.targetDomainId === targetDomainId);
    return matchedRule?.mode ?? "deny";
  }

  private isCodingTaskType(taskType: string): taskType is CodingTaskType {
    return ["analyze", "plan", "implement", "test", "review", "release"].includes(taskType);
  }
}
