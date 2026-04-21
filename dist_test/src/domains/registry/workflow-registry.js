export class WorkflowRegistry {
    workflows = new Map();
    registerAll(workflows) {
        for (const workflow of workflows) {
            this.workflows.set(workflow.workflowId, workflow);
        }
    }
    get(workflowId) {
        return this.workflows.get(workflowId) ?? null;
    }
    list() {
        return [...this.workflows.values()];
    }
}
//# sourceMappingURL=workflow-registry.js.map