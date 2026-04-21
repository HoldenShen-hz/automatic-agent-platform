import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { type Plan, type TaskSituation, type UnifiedAssessment } from "../oapeflir/types/index.js";
export interface PlanBuilderInput {
    observation: TaskSituation;
    assessment: UnifiedAssessment;
    workflow: PlannedWorkflow;
    version?: number;
    parentVersion?: number;
}
export declare class PlanBuilder {
    private readonly decomposition;
    private readonly dagValidator;
    private readonly strategySelector;
    build(input: PlanBuilderInput): Plan;
    replan(previousPlan: Plan, input: Omit<PlanBuilderInput, "version" | "parentVersion">): Plan;
}
