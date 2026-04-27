export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
}

export interface OrgGovernanceSagaResult {
  readonly sagaId: string;
  readonly status: "committed" | "compensated";
  readonly preparedNodeIds: readonly string[];
  readonly committedNodeIds: readonly string[];
  readonly compensatedNodeIds: readonly string[];
  readonly auditStepIds: readonly string[];
}

export class OrgGovernanceSaga {
  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaResult {
    const preparedNodeIds = steps
      .filter((step) => step.action === "prepare")
      .map((step) => step.targetOrgNodeId);
    const committedNodeIds = steps
      .filter((step) => step.action === "commit")
      .map((step) => step.targetOrgNodeId);
    const compensatedNodeIds = steps
      .filter((step) => step.action === "compensate")
      .map((step) => step.targetOrgNodeId);
    const auditStepIds = steps
      .filter((step) => step.action === "audit")
      .map((step) => step.stepId);

    return {
      sagaId,
      status: compensatedNodeIds.length > 0 ? "compensated" : "committed",
      preparedNodeIds,
      committedNodeIds,
      compensatedNodeIds,
      auditStepIds,
    };
  }
}
