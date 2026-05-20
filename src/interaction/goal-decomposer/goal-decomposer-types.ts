import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import type { BudgetLedger, BudgetResourceKind } from "../../platform/contracts/executable-contracts/index.js";
import type { BudgetPolicy } from "../../platform/model-gateway/cost-tracker/index.js";
import type { RiskPreview } from "../nl-gateway/index.js";
import type { DomainRecipe } from "../../domains/recipes/index.js";
import type { LlmPlanGenerator } from "./llm-plan-generator.js";

export interface SuccessCriterion {
  readonly metric: string;
  readonly target: string;
  readonly operator?: ">=" | "<=" | ">" | "<" | "==" | "!=";
  readonly threshold?: number;
  readonly evaluationMethod: "metric_api" | "human_review" | "automated_test";
}

export interface Goal {
  readonly goalId: string;
  readonly description: string;
  readonly owner: string;
  readonly deadline?: string;
  readonly successCriteria: readonly SuccessCriterion[];
  readonly constraints: readonly string[];
  readonly priority: "low" | "normal" | "high" | "critical";
}

export interface PlannedTask {
  readonly taskId: string;
  readonly domainId: string;
  readonly description: string;
  readonly inputs: Record<string, unknown>;
  readonly expectedOutputs: readonly string[];
  readonly delegationMode: "auto" | "supervised" | "manual";
  readonly estimatedDuration: string;
  readonly estimatedCost: CostEstimate;
  readonly constraintEnvelope?: GoalConstraintEnvelope;
  readonly dependsOn?: readonly string[];
}

export interface TaskDependency {
  readonly fromTask: string;
  readonly toTask: string;
  readonly type: "blocks" | "provides_input" | "soft_dependency";
  readonly dataContract?: string;
}

export interface GoalDecomposition {
  readonly goalId: string;
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
  readonly estimatedDuration: string;
  readonly estimatedCost: CostEstimate;
  readonly riskSummary: RiskPreview;
  readonly decompositionConfidence: number;
  readonly requiresHumanReview: boolean;
  readonly decompositionStrategy?: "template" | "llm_plan" | "hybrid" | "human_assisted";
  readonly topologicallySortedTaskIds?: readonly string[];
  readonly parallelTaskGroups?: readonly (readonly string[])[];
  readonly criticalPathTaskIds?: readonly string[];
  readonly depthUsed: number;
  readonly maxDepthReached: boolean;
  readonly lifecycleState: GoalLifecycleState;
  readonly goalGraphDraft: GoalGraphDraft;
  readonly taskGraphDraft: TaskGraphDraft;
  readonly plannerHandoff: PlannerHandoffReceipt;
  readonly harnessRouting?: GoalHarnessRouting;
}

export type GoalLifecycleState =
  | "draft"
  | "decomposing"
  | "decomposed"
  | "partially_completed"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export interface GoalConstraintEnvelope {
  readonly budgetLimitUsd: number | null;
  readonly riskTolerance: "low" | "medium" | "high";
  readonly requiresApproval: boolean;
  readonly requiredPermissions: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly budgetAllocations?: readonly GoalBudgetAllocation[];
  readonly riskPropagation?: readonly GoalRiskPropagationRecord[];
}

export interface GoalBudgetAllocation {
  readonly taskId: string;
  readonly budgetUsd: number;
  readonly riskMultiplier: number;
}

export interface GoalRiskPropagationRecord {
  readonly taskId: string;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
}

export interface GoalGraphDraft {
  readonly goalId: string;
  readonly lifecycleState: GoalLifecycleState;
  readonly constraintEnvelope: GoalConstraintEnvelope;
  readonly plannerIntent: "template" | "llm_plan" | "hybrid" | "human_assisted";
  readonly evidenceRefs: readonly string[];
}

export interface TaskGraphDraft {
  readonly graphId: string;
  readonly goalId: string;
  readonly tasks: readonly PlannedTask[];
  readonly dependencyGraph: readonly TaskDependency[];
  readonly normalized: boolean;
  readonly validationMessages: readonly string[];
  readonly worstPathTaskIds: readonly string[];
}

export interface PlannerHandoffReceipt {
  readonly handoffId: string;
  readonly goalId: string;
  readonly state: "ready_for_planner" | "blocked_invalid_graph";
  readonly graphId: string;
  readonly constraintEnvelope: GoalConstraintEnvelope;
  readonly harnessRunId?: string;
  readonly planGraphBundleId?: string;
  readonly budgetLedgerId?: string;
  readonly budgetReservationId?: string;
  readonly reservedBudgetUsd?: number | null;
}

export interface GoalHarnessRouting {
  readonly harnessRun: {
    readonly harnessRunId: string;
    readonly domainId: string;
  };
  readonly planGraphBundle: {
    readonly planGraphBundleId: string;
    readonly validationReport: { readonly valid: boolean };
    readonly graph: {
      readonly nodes: ReadonlyArray<{ readonly nodeId: string }>;
      readonly edges: readonly TaskDependency[];
    };
  };
  readonly initialStep: {
    readonly nodeRun: { readonly harnessRunId: string; readonly nodeId: string };
    readonly receipt: { readonly status: "succeeded" | "blocked" };
  };
}

export type GoalDecompositionResult = GoalDecomposition;

export interface GoalDecompositionPort {
  decompose(goal: Goal | string): Promise<GoalDecomposition>;
}

export interface GoalDecompositionServiceOptions {
  readonly costEstimator?: { estimate(divisionId?: string | null): CostEstimate } | null;
  readonly llmPlanGenerator?: LlmPlanGenerator | null;
  readonly maxLlmPlanLatencyMs?: number;
  readonly maxDepth?: number;
  readonly currentDepth?: number;
  readonly maxDelegationDepth?: number;
  readonly callDepth?: number;
  readonly globalCallDepth?: number;
  readonly budgetControl?: {
    readonly policy: BudgetPolicy;
    readonly currentTaskCostUsd?: number;
    readonly currentDailyCostUsd?: number;
    readonly currentMonthlyCostUsd?: number;
    readonly tenantId: string;
    readonly harnessRunId: string;
    readonly traceId: string;
    readonly emittedBy: string;
    readonly ledger?: BudgetLedger;
    readonly estimatedLlmPlanCostUsd?: number;
    readonly resourceKind?: BudgetResourceKind;
    readonly expiresAt?: string;
  };
  readonly domainCapabilities?: Readonly<Record<string, readonly string[]>>;
  readonly domainRecipes?: readonly DomainRecipe[];
  readonly domainRecipeService?: {
    matchRecipe(domainId: string, input: string): { archetype?: string; triggerPhrases?: readonly string[] } | null;
  } | null;
  readonly planGraphHarnessRuntime?: unknown;
}

export interface CapabilityValidationResult {
  readonly valid: boolean;
  readonly missingCapabilities: readonly string[];
  readonly unauthorizedPermissions: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly validationMessages: readonly string[];
}
