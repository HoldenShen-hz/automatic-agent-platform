import type { CostEstimate } from "../../scale-ecosystem/marketplace/cost-estimation-service.js";
import type { RiskPreview } from "../nl-gateway/index.js";
export interface SuccessCriterion {
    readonly metric: string;
    readonly target: string;
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
    /** @deprecated Use dependencyGraph instead - explicit depends_on for DAG scheduling */
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
    /** Actual depth used in decomposition (may be less than maxDepth if goal is simple) */
    readonly depthUsed: number;
    /** Whether maxDepth was reached during decomposition */
    readonly maxDepthReached: boolean;
}
export type GoalDecompositionResult = GoalDecomposition;
export interface GoalDecompositionPort {
    decompose(goal: Goal | string): Promise<GoalDecomposition>;
}
export interface GoalDecompositionServiceOptions {
    readonly costEstimator?: {
        estimate(divisionId?: string | null): CostEstimate;
    } | null;
    /** Maximum decomposition depth to prevent infinite recursion (default: 5) */
    readonly maxDepth?: number;
    /** Current decomposition depth (used internally, do not set manually) */
    readonly currentDepth?: number;
}
export declare class GoalDecompositionService implements GoalDecompositionPort {
    private readonly options;
    constructor(options?: GoalDecompositionServiceOptions);
    decompose(goalInput: Goal | string): Promise<GoalDecomposition>;
    private detectTemplate;
    private buildTasks;
    private buildDependencies;
    private makeTask;
    private analyzeDependencyGraph;
}
