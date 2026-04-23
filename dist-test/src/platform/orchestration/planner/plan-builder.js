import { newId } from "../../contracts/types/ids.js";
import { createAssessmentRef, parsePlan } from "../oapeflir/types/index.js";
import { TaskDecompositionService } from "./task-decomposition-service.js";
import { PlanDagValidator } from "./plan-dag-validator.js";
import { PlanStrategySelector } from "./plan-strategy-selector.js";
export class PlanBuilder {
    decomposition = new TaskDecompositionService();
    dagValidator = new PlanDagValidator();
    strategySelector = new PlanStrategySelector();
    build(input) {
        const decomposed = this.decomposition.decompose(input.workflow);
        const steps = decomposed.map((item, index) => ({
            stepId: input.workflow.executionSteps[index]?.stepId ?? `step_${index + 1}`,
            action: item.toolNames[0] ?? (index === 0 ? "read" : "execute"),
            title: item.title,
            inputs: {
                ownerRoleId: item.ownerRoleId,
                inputKeys: [...(input.workflow.executionSteps[index]?.inputKeys ?? [])],
            },
            outputs: input.workflow.executionSteps[index]?.outputKey != null ? [input.workflow.executionSteps[index].outputKey] : [],
            dependencies: item.dependsOn,
            status: "pending",
            timeout: input.workflow.executionSteps[index]?.timeoutMs ?? 60000,
            retryPolicy: {
                maxRetries: Math.max(0, (input.workflow.executionSteps[index]?.maxAttempts ?? 1) - 1),
                backoffMs: 250 * (index + 1),
            },
        }));
        const dagValidation = this.dagValidator.validate(steps);
        const strategy = this.strategySelector.select(input);
        return parsePlan({
            planId: newId("plan"),
            taskId: input.observation.taskId,
            assessmentRef: createAssessmentRef(input.assessment),
            version: input.version ?? 1,
            strategy: input.version != null && input.version > 1 ? "replanned" : strategy,
            steps: dagValidation.orderedSteps,
            createdAt: Date.now(),
            parentVersion: input.parentVersion,
        });
    }
    replan(previousPlan, input) {
        return this.build({
            ...input,
            version: previousPlan.version + 1,
            parentVersion: previousPlan.version,
        });
    }
}
//# sourceMappingURL=plan-builder.js.map