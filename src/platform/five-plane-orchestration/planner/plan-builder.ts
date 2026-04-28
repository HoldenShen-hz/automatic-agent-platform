import { newId } from "../../contracts/types/ids.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { createAssessmentRef, parsePlan, type Plan, type PlanStep, type TaskSituation, type UnifiedAssessment } from "../oapeflir/types/index.js";
import { TaskDecompositionService } from "./task-decomposition-service.js";
import { PlanDagValidator } from "./plan-dag-validator.js";
import { PlanStrategySelector } from "./plan-strategy-selector.js";

export interface PlanBuilderInput {
  observation: TaskSituation;
  assessment: UnifiedAssessment;
  workflow: PlannedWorkflow;
  version?: number;
  parentVersion?: number;
}

export class PlanBuilder {
  private readonly decomposition = new TaskDecompositionService();
  private readonly dagValidator = new PlanDagValidator();
  private readonly strategySelector = new PlanStrategySelector();

  public build(input: PlanBuilderInput): Plan {
    const decomposed = this.decomposition.decompose(input.workflow);
    const steps: PlanStep[] = decomposed.map((item, index) => ({
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

  public replan(previousPlan: Plan, input: Omit<PlanBuilderInput, "version" | "parentVersion">): Plan {
    return this.build({
      ...input,
      version: previousPlan.version + 1,
      parentVersion: previousPlan.version,
    });
  }
}
