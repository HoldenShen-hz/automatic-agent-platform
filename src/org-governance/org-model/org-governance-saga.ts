export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
  readonly phase: OrgGovernancePhase;
}

export type OrgGovernancePhase = "identity" | "approval" | "budget" | "domain" | "agent";

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

const PHASE_ORDER: OrgGovernancePhase[] = ["identity", "approval", "budget", "domain", "agent"];

function sortStepsByPhase(steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaStep[] {
  return [...steps].sort((left, right) => {
    const leftIdx = PHASE_ORDER.indexOf(left.phase);
    const rightIdx = PHASE_ORDER.indexOf(right.phase);
    if (leftIdx !== rightIdx) {
      return leftIdx - rightIdx;
    }
    return left.stepId.localeCompare(right.stepId);
  });
}

export interface OrgGovernanceSagaReceipt {
  readonly sagaId: string;
  readonly status: "committed" | "compensated";
  readonly phaseCommitOrder: readonly OrgGovernancePhase[];
  readonly preparedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly committedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly compensatedByPhase: Readonly<Record<OrgGovernancePhase, readonly string[]>>;
  readonly failedPhase: OrgGovernancePhase | null;
  readonly executionLog: readonly {
    stepId: string;
    action: OrgGovernanceSagaStep["action"];
    phase: OrgGovernancePhase;
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
}

export class OrgGovernanceSaga {
  public constructor(private readonly handlers: OrgGovernanceSagaHandlers = {}) {}

  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaResult {
    const sortedSteps = sortStepsByPhase(steps);
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaResult["executionLog"][number]> = [];
    let failedStepId: string | null = null;
    const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

    for (const step of sortedSteps.filter((candidate) => candidate.action === "prepare")) {
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
      for (const step of sortedSteps.filter((candidate) => candidate.action === "commit")) {
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
      const compensationSteps = sortedSteps.filter((candidate) => candidate.action === "compensate");
      const compensationNodes = [...new Set([...committedNodeIds, ...preparedNodeIds])].reverse();
      for (const nodeId of compensationNodes) {
        const compensationStep =
          compensationSteps.find((candidate) => candidate.targetOrgNodeId === nodeId)
          ?? {
            stepId: `${failedStepId}:compensate:${nodeId}`,
            action: "compensate" as const,
            targetOrgNodeId: nodeId,
            phase: "domain" as OrgGovernancePhase,
          };
        // §9.2: Wrap compensation in try-catch to prevent cascade failure
        // Compensation failures should not throw - saga must complete all compensation steps
        try {
          this.handlers.compensate?.(compensationStep, context());
          compensatedNodeIds.push(nodeId);
          executionLog.push({
            stepId: compensationStep.stepId,
            action: compensationStep.action,
            targetOrgNodeId: compensationStep.targetOrgNodeId,
            outcome: "compensated",
          });
        } catch {
          // Record compensation failure but continue with remaining compensation steps
          executionLog.push({
            stepId: compensationStep.stepId,
            action: compensationStep.action,
            targetOrgNodeId: compensationStep.targetOrgNodeId,
            outcome: "failed",
          });
        }
      }
    }
    // else: no failure - no compensation needed; proceed directly to audit

    for (const step of sortedSteps.filter((candidate) => candidate.action === "audit")) {
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

  public executeWithReceipt(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaReceipt {
    const result = this.execute(sagaId, steps);

    const enrichedLog = result.executionLog.map((entry) => {
      const step = steps.find((s) => s.stepId === entry.stepId);
      return { ...entry, phase: step?.phase ?? "domain" };
    });

    const preparedByPhase = buildPhaseMap(enrichedLog, "prepared");
    const committedByPhase = buildPhaseMap(enrichedLog, "committed");
    const compensatedByPhase = buildPhaseMap(enrichedLog, "compensated");

    const failedPhaseEntry = enrichedLog.find((entry) => entry.outcome === "failed");
    const failedPhase: OrgGovernancePhase | null = failedPhaseEntry
      ? steps.find((s) => s.stepId === failedPhaseEntry.stepId)?.phase ?? null
      : null;

    return {
      sagaId: result.sagaId,
      status: result.status,
      phaseCommitOrder: PHASE_ORDER,
      preparedByPhase,
      committedByPhase,
      compensatedByPhase,
      failedPhase,
      executionLog: enrichedLog,
    };
  }
}

function buildPhaseMap(
  log: readonly { stepId: string; outcome: string; targetOrgNodeId: string; phase: OrgGovernancePhase }[],
  outcomeFilter: string,
): Readonly<Record<OrgGovernancePhase, readonly string[]>> {
  const phaseMap: Record<OrgGovernancePhase, string[]> = {
    identity: [],
    approval: [],
    budget: [],
    domain: [],
    agent: [],
  };
  for (const entry of log) {
    if (entry.outcome === outcomeFilter) {
      phaseMap[entry.phase].push(entry.targetOrgNodeId);
    }
  }
  return phaseMap;
}
