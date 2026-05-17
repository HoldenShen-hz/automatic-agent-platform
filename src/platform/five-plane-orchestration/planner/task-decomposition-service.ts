import type { PlannedWorkflow } from "../routing/workflow-planner.js";

export interface TaskDecomposition {
  title: string;
  dependsOn: string[];
  ownerRoleId: string;
  toolNames: string[];
}

export class TaskDecompositionService {
  public decompose(workflow: PlannedWorkflow): TaskDecomposition[] {
    return workflow.executionSteps.map((step) => {
      const dependsOnStepIds = step.dependsOnStepIds ?? [];
      return {
        title: `${step.stepId}:${step.outputKey}`,
        dependsOn: [...dependsOnStepIds],
        ownerRoleId: step.roleId,
        toolNames: [
          ...(dependsOnStepIds.length > 0 ? ["read"] : []),
          ...(step.compensationModel != null ? ["apply_patch"] : []),
          ...(step.outputSchemaPath != null ? ["validate_output"] : []),
        ],
      };
    });
  }
}
