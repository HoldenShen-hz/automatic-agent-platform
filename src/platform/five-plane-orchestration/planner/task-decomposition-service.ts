import type { PlannedWorkflow } from "../routing/workflow-planner.js";

export interface TaskDecomposition {
  title: string;
  dependsOn: string[];
  ownerRoleId: string;
  toolNames: string[];
}

export class TaskDecompositionService {
  public decompose(workflow: PlannedWorkflow): TaskDecomposition[] {
    return workflow.executionSteps.map((step) => ({
      title: `${step.stepId}:${step.outputKey}`,
      dependsOn: [...step.dependsOnStepIds],
      ownerRoleId: step.roleId,
      toolNames: [
        // Only prepend "read" for steps with dependencies (need to read prior outputs)
        // or steps with compensation/output validation needs
        ...(step.dependsOnStepIds.length > 0 ? ["read"] : []),
        ...(step.compensationModel != null ? ["apply_patch"] : []),
        ...(step.outputSchemaPath != null ? ["validate_output"] : []),
      ],
    }));
  }
}
