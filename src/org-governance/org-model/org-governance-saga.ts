export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
}

export interface OrgGovernanceSagaHandlerContext {
  readonly sagaId: string;
  readonly failedStepId: string | null;
}

export interface OrgGovernanceSagaHandlers {
  readonly prepare?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly commit?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly compensate?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
  readonly audit?: (step: OrgGovernanceSagaStep, context: OrgGovernanceSagaHandlerContext) => void;
}

export interface OrgGovernanceSagaResult {
  readonly sagaId: string;
  readonly status: "committed" | "compensated";
  readonly preparedNodeIds: readonly string[];
  readonly committedNodeIds: readonly string[];
  readonly compensatedNodeIds: readonly string[];
  readonly auditStepIds: readonly string[];
  readonly failedStepId: string | null;
  readonly executionLog: readonly {
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
}

export class OrgGovernanceSaga {
  public constructor(private readonly handlers: OrgGovernanceSagaHandlers = {}) {}

  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaResult {
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaResult["executionLog"][number]> = [];
    let failedStepId: string | null = null;
    const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

    for (const step of steps.filter((candidate) => candidate.action === "prepare")) {
      try {
        this.handlers.prepare?.(step, context());
        preparedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "prepared",
        });
      } catch {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
        break;
      }
    }

    const preparedSet = new Set(preparedNodeIds);
    if (failedStepId == null) {
      for (const step of steps.filter((candidate) => candidate.action === "commit")) {
        if (!preparedSet.has(step.targetOrgNodeId)) {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "skipped",
          });
          break;
        }
        try {
          this.handlers.commit?.(step, context());
          committedNodeIds.push(step.targetOrgNodeId);
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "committed",
          });
        } catch {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "failed",
          });
          break;
        }
      }
    }

    if (failedStepId != null) {
      const compensationSteps = steps.filter((candidate) => candidate.action === "compensate");
      const compensationNodes = [...new Set([...committedNodeIds, ...preparedNodeIds])].reverse();
      for (const nodeId of compensationNodes) {
        const compensationStep =
          compensationSteps.find((candidate) => candidate.targetOrgNodeId === nodeId)
          ?? {
            stepId: `${failedStepId}:compensate:${nodeId}`,
            action: "compensate" as const,
            targetOrgNodeId: nodeId,
          };
        this.handlers.compensate?.(compensationStep, context());
        compensatedNodeIds.push(nodeId);
        executionLog.push({
          stepId: compensationStep.stepId,
          action: compensationStep.action,
          targetOrgNodeId: compensationStep.targetOrgNodeId,
          outcome: "compensated",
        });
      }
    } else {
      for (const step of steps.filter((candidate) => candidate.action === "compensate")) {
        this.handlers.compensate?.(step, context());
        compensatedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "compensated",
        });
      }
    }

    for (const step of steps.filter((candidate) => candidate.action === "audit")) {
      this.handlers.audit?.(step, context());
      auditStepIds.push(step.stepId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "audited",
      });
    }

    return {
      sagaId,
      status: failedStepId != null || compensatedNodeIds.length > 0 ? "compensated" : "committed",
      preparedNodeIds,
      committedNodeIds,
      compensatedNodeIds,
      auditStepIds,
      failedStepId,
      executionLog,
    };
  }
}
