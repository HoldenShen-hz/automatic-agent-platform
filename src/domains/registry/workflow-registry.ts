import type { WorkflowConfig } from "./domain-model.js";

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowConfig>();

  public registerAll(workflows: readonly WorkflowConfig[]): void {
    for (const workflow of workflows) {
      this.workflows.set(workflow.workflowId, workflow);
    }
  }

  public get(workflowId: string): WorkflowConfig | null {
    return this.workflows.get(workflowId) ?? null;
  }

  public list(): WorkflowConfig[] {
    return [...this.workflows.values()];
  }
}
