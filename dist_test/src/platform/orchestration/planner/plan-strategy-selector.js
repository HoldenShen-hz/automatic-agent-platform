export class PlanStrategySelector {
    select(input) {
        const stepCount = input.workflow.executionSteps.length;
        const divisionCount = new Set(input.workflow.executionSteps.map((step) => step.divisionId)).size;
        const availableTools = new Set(input.observation.environmentContext.availableTools);
        const destructiveTools = ["apply_patch", "deploy", "shell"].some((tool) => availableTools.has(tool));
        const tokenBudget = input.assessment.resourceAllocation.maxTokens;
        const timeoutMs = input.assessment.resourceAllocation.timeoutMs;
        const objective = input.observation.objective.toLowerCase();
        if (input.assessment.complexity === "trivial" || (stepCount <= 2 && input.assessment.risk === "low")) {
            return "linear";
        }
        if (divisionCount > 1 && timeoutMs >= 30_000) {
            return "hierarchical";
        }
        if (input.assessment.risk === "critical" || destructiveTools) {
            return "reflexive";
        }
        if (objective.includes("goal") || objective.includes("目标")) {
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
//# sourceMappingURL=plan-strategy-selector.js.map