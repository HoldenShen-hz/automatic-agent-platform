import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
export function createExecutionPlan(input) {
    if (input.steps.length === 0) {
        throw new ValidationError("execution_plan.steps_required", "Execution plan requires at least one step.");
    }
    for (const step of input.steps) {
        if (step.stepId.trim().length === 0 || step.actionRef.trim().length === 0 || step.title.trim().length === 0) {
            throw new ValidationError("execution_plan.invalid_step", "Execution plan step is missing required fields.", {
                details: { step },
            });
        }
    }
    return {
        planId: input.planId ?? newId("plan"),
        taskId: input.taskId,
        tenantId: input.tenantId ?? null,
        version: input.version,
        steps: input.steps.map((step) => ({ ...step, dependsOn: [...step.dependsOn] })),
        createdAt: input.createdAt ?? nowIso(),
    };
}
//# sourceMappingURL=index.js.map