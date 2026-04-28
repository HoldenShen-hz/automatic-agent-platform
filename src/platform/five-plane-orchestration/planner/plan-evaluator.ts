import type { Plan, UnifiedAssessment } from "../oapeflir/types/index.js";
import { PlanDagValidator } from "./plan-dag-validator.js";

export interface PlanEvaluation {
  viable: boolean;
  riskLevel: UnifiedAssessment["risk"];
  issues: string[];
}

export class PlanEvaluator {
  private readonly dagValidator = new PlanDagValidator();

  public evaluate(plan: Plan, assessment: UnifiedAssessment): PlanEvaluation {
    const issues: string[] = [];
    if (plan.steps.length === 0) {
      issues.push("planning.empty_plan");
    }
    if (assessment.risk === "critical" && !assessment.approvalPolicy.required) {
      issues.push("planning.missing_critical_approval_constraint");
    }
    const dagValidation = this.dagValidator.validate(plan.steps);
    issues.push(...dagValidation.issues);
    const estimatedTokenBudget = plan.steps.length * 1000;
    if (estimatedTokenBudget > assessment.resourceAllocation.maxTokens) {
      issues.push("planning.resource_budget_exceeded");
    }
    return {
      viable: issues.length === 0,
      riskLevel: assessment.risk,
      issues,
    };
  }
}
