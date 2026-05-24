import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import type { PlanStrategy, TaskSituation, UnifiedAssessment } from "../oapeflir/types/index.js";

export interface PlanStrategySelectionInput {
  observation: TaskSituation;
  assessment: UnifiedAssessment;
  workflow: PlannedWorkflow;
}

export class PlanStrategySelector {
  public select(input: PlanStrategySelectionInput): PlanStrategy {
    const stepCount = input.workflow.executionSteps.length;
    const divisionCount = new Set(input.workflow.executionSteps.map((step) => step.divisionId)).size;
    const availableTools = new Set(input.observation.environmentContext?.availableTools ?? []);
    const destructiveTools = ["apply_patch", "deploy", "shell"].some((tool) => availableTools.has(tool));
    const tokenBudget = input.assessment.resourceAllocation?.maxTokens ?? Number.POSITIVE_INFINITY;
    const timeoutMs = input.assessment.resourceAllocation?.timeoutMs ?? 60_000;
    const objective = (
      input.observation.objective
      ?? input.observation.userIntent?.normalized
      ?? input.observation.userIntent?.raw
      ?? ""
    ).toLowerCase();

    if (input.assessment.risk === "critical" || destructiveTools) {
      return "reflexive";
    }
    if (divisionCount > 1 && timeoutMs >= 30_000) {
      return "hierarchical";
    }
    if (input.assessment.complexity === "trivial" || (stepCount <= 2 && input.assessment.risk === "low")) {
      return "linear";
    }
    if (objective.includes("goal") || objective.includes("target")) {
      return "goal_driven";
    }
    if (tokenBudget <= 2_000 || timeoutMs < 20_000) {
      return "resource_constrained";
    }
    if (input.assessment.complexity === "complex" || input.assessment.complexity === "critical") {
      return tokenBudget >= 10_000 ? "tree_branch" : "reflexive";
    }
    if (stepCount >= 5) {
      return "online";
    }
    return "linear";
  }
}
