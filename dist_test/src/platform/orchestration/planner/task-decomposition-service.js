export class TaskDecompositionService {
    decompose(workflow) {
        return workflow.executionSteps.map((step) => ({
            title: `${step.stepId}:${step.outputKey}`,
            dependsOn: [...step.dependsOnStepIds],
            ownerRoleId: step.roleId,
            toolNames: [
                "read",
                ...(step.compensationModel != null ? ["apply_patch"] : []),
                ...(step.outputSchemaPath != null ? ["validate_output"] : []),
            ],
        }));
    }
}
//# sourceMappingURL=task-decomposition-service.js.map