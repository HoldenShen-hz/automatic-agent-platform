import { CODING_DOMAIN_PRESET, requiresCodingReview, type CodingTaskType } from "./coding/index.js";
import { type DomainLifecycleState, DomainLifecycleStateSchema } from "./domain-specs.js";
import { listBlockingEvaluators, type DomainEvalFramework } from "./eval-framework/index.js";
import { type DomainInteractionRule } from "./interaction-policy/index.js";
import { resolveKnowledgeNamespaces, type DomainKnowledgeSchema } from "./knowledge-schema/index.js";
import { type DomainOnboardingPhase } from "./operations/index.js";
import { type DomainPromptLibrary } from "./prompt-library/index.js";
import { type DomainRecipe } from "./recipes/index.js";
import { type DomainRiskProfile } from "./risk-profile/index.js";

export interface DomainDescriptorInput {
  readonly domainId: string;
  readonly displayName: string;
  readonly description: string;
  readonly ownerOrgNodeId: string;
  readonly lifecycleState: DomainLifecycleState | "draft" | "validated" | "registered" | "updating" | "archived";
  readonly version: number;
  readonly riskProfile: DomainRiskProfile;
  readonly knowledgeSchema: DomainKnowledgeSchema;
  readonly evalFramework: DomainEvalFramework;
  readonly promptLibrary: DomainPromptLibrary;
  readonly recipes: readonly DomainRecipe[];
  readonly interactionPolicy?: string;
  readonly governancePolicy?: string;
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
  readonly interactionPolicy: string;
  readonly governancePolicy: string;
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

export class DomainDescriptorOrchestrationService {
  public review(input: DomainDescriptorInput): DomainDescriptorReview {
    const lifecycleState = normalizeLifecycleState(input.lifecycleState);
    const blockingEvaluatorIds = listBlockingEvaluators(input.evalFramework).map((item) => item.evaluatorId);
    const promptIds = input.promptLibrary.prompts.map((item) => item.promptId);
    const promptStageCoverage = [...new Set(input.promptLibrary.prompts.map((item) => item.stage))];
    const recipeIds = input.recipes.map((item) => item.recipeId);
    const interactionPolicy = input.interactionPolicy?.trim() || "platform_default";
    const governancePolicy = input.governancePolicy?.trim() || "platform_default";
    const defaultKnowledgeNamespaces = resolveKnowledgeNamespaces(input.knowledgeSchema);
    const crossDomainModes = Object.fromEntries(
      (input.interactionRules ?? []).map((rule) => [`${rule.sourceDomainId}->${rule.targetDomainId}`, rule.mode]),
    );

    const reviewRequiredTaskTypes = input.domainId === CODING_DOMAIN_PRESET.domainId
      ? CODING_DOMAIN_PRESET.reviewRequiredTaskTypes.filter((taskType) => requiresCodingReview(taskType as CodingTaskType))
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
      ...(lifecycleState === "active" && input.riskProfile.defaultRiskLevel === "critical"
        ? ["domain_descriptor.high_risk_active_requires_registered_release_evidence"]
        : []),
    ];

    return {
      domainId: input.domainId,
      lifecycleState,
      ownerOrgNodeId: input.ownerOrgNodeId,
      blockingEvaluatorIds,
      promptIds,
      promptStageCoverage,
      recipeIds,
      interactionPolicy,
      governancePolicy,
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

  public buildOnboardingChecklist(domainId: string): DomainOnboardingChecklist {
    return {
      domainId,
      phases: [
        {
          phase: "domain_modeling",
          requiredEvidence: ["descriptor", "risk_profile", "knowledge_schema"],
        },
        {
          phase: "pack_development",
          requiredEvidence: ["domain_lint", "workflow_validation", "eval_framework", "prompt_library"],
        },
        {
          phase: "security_certification",
          requiredEvidence: ["security_review", "interaction_policy", "approval_path"],
        },
        {
          phase: "gray_rollout",
          requiredEvidence: ["rollout_metrics", "rollback_plan", "operator_signoff"],
        },
      ],
    };
  }
}

function normalizeLifecycleState(value: DomainDescriptorInput["lifecycleState"]): DomainDescriptorInput["lifecycleState"] {
  if (value === "validating") {
    return "validated";
  }
  if (value === "canary") {
    return "registered";
  }
  return DomainLifecycleStateSchema.parse(value);
}
