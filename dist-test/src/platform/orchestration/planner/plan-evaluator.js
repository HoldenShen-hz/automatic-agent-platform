import { PlanDagValidator } from "./plan-dag-validator.js";
export class PlanEvaluator {
    dagValidator = new PlanDagValidator();
    evaluate(plan, assessment) {
        const issues = [];
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
//# sourceMappingURL=plan-evaluator.js.map