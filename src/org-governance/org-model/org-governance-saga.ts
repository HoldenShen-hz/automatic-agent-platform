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
  readonly failedStepId: string | null;
  readonly executionLog: readonly {
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped";
  }[];
}

export class OrgGovernanceSaga {
  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaResult {
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaResult["executionLog"][number]> = [];
    let failedStepId: string | null = null;

    for (const step of steps.filter((candidate) => candidate.action === "prepare")) {
      preparedNodeIds.push(step.targetOrgNodeId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "prepared",
      });
    }

    const preparedSet = new Set(preparedNodeIds);
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
      committedNodeIds.push(step.targetOrgNodeId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        targetOrgNodeId: step.targetOrgNodeId,
        outcome: "committed",
      });
    }

    if (failedStepId != null) {
      for (const nodeId of [...committedNodeIds].reverse()) {
        compensatedNodeIds.push(nodeId);
        executionLog.push({
          stepId: `${failedStepId}:compensate:${nodeId}`,
          action: "compensate",
          targetOrgNodeId: nodeId,
          outcome: "compensated",
        });
      }
    } else {
      for (const step of steps.filter((candidate) => candidate.action === "compensate")) {
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
