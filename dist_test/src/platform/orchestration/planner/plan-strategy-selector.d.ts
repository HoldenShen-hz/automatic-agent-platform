import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import type { PlanStrategy, TaskSituation, UnifiedAssessment } from "../oapeflir/types/index.js";
export interface PlanStrategySelectionInput {
    observation: TaskSituation;
    assessment: UnifiedAssessment;
    workflow: PlannedWorkflow;
}
export declare class PlanStrategySelector {
    select(input: PlanStrategySelectionInput): PlanStrategy;
}
