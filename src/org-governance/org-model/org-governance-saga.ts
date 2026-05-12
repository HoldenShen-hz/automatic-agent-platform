export type OrgGovernancePhase = "identity" | "approval" | "budget" | "domain" | "agent";

export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
  readonly phase?: OrgGovernancePhase;
  /** Required capabilities for this step to execute */
  readonly requiredCapabilities?: readonly string[];
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
    phase: OrgGovernancePhase;
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
}

export interface OrgGovernanceSagaReceipt {
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
    phase: OrgGovernancePhase;
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
  /** Commit sequence version - monotonically increasing per-org, enforced ordering */
  readonly commitSequenceVersion: number;
}

export interface OrgGovernanceSagaExtendedReceipt extends OrgGovernanceSagaReceipt {
  readonly phaseCommitOrder: readonly OrgGovernancePhase[];
  readonly preparedByPhase: Record<OrgGovernancePhase, string[]>;
  readonly committedByPhase: Record<OrgGovernancePhase, string[]>;
  readonly compensatedByPhase: Record<OrgGovernancePhase, string[]>;
  readonly failedPhase: OrgGovernancePhase | null;
}

const PHASE_ORDER: readonly OrgGovernancePhase[] = ["identity", "approval", "budget", "domain", "agent"];

/**
 * R9-31: OrgNodeWithCapabilities - org node with capability information for governance validation
 */
export interface OrgNodeWithCapabilities {
  readonly orgNodeId: string;
  readonly parentOrgNodeId: string | null;
  readonly ownerUserIds: readonly string[];
  readonly capabilities: readonly string[];
  readonly nodeType: string;
}

/**
 * R9-31: Options for OrgGovernanceSaga with OrgTree support
 */
export interface OrgGovernanceSagaOptions {
  /** OrgTree nodes for capability validation */
  readonly orgNodes?: ReadonlyArray<OrgNodeWithCapabilities>;
  /** Traverse up the org tree to find nodes with required capabilities */
  readonly traverseForCapabilities?: boolean;
  /** Maximum traversal depth when looking for capabilities */
  readonly maxTraversalDepth?: number;
}

export class OrgGovernanceSaga {
  private nextCommitSequenceVersion = 0;
  private readonly orgNodes: ReadonlyArray<OrgNodeWithCapabilities> | undefined;
  private readonly traverseForCapabilities: boolean;
  private readonly maxTraversalDepth: number;

  public constructor(
    private readonly handlers: OrgGovernanceSagaHandlers = {},
    options: OrgGovernanceSagaOptions = {},
  ) {
    this.orgNodes = options.orgNodes;
    this.traverseForCapabilities = options.traverseForCapabilities ?? true;
    this.maxTraversalDepth = options.maxTraversalDepth ?? 3;
  }

  /**
   * R9-31: Find org node by ID
   */
  private findOrgNode(orgNodeId: string): OrgNodeWithCapabilities | null {
    return this.orgNodes?.find((n) => n.orgNodeId === orgNodeId) ?? null;
  }

  /**
   * R9-31: Traverse org hierarchy to find a node with required capabilities
   */
  private findNodeWithCapabilities(
    startOrgNodeId: string,
    requiredCapabilities: readonly string[],
  ): OrgNodeWithCapabilities | null {
    if (!this.traverseForCapabilities || !this.orgNodes) {
      return null;
    }

    let currentNodeId: string | null = startOrgNodeId;
    let depth = 0;

    while (currentNodeId != null && depth < this.maxTraversalDepth) {
      const node = this.findOrgNode(currentNodeId);
      if (!node) {
        break;
      }

      // Check if this node has all required capabilities
      const hasAllCapabilities = requiredCapabilities.every((cap) =>
        node.capabilities.includes(cap),
      );

      if (hasAllCapabilities) {
        return node;
      }

      // Move to parent
      currentNodeId = node.parentOrgNodeId;
      depth++;
    }

    return null;
  }

  /**
   * R9-31: Validate that a step's required capabilities are available
   */
  private validateStepCapabilities(step: OrgGovernanceSagaStep): { valid: boolean; reason?: string } {
    if (!step.requiredCapabilities || step.requiredCapabilities.length === 0) {
      return { valid: true };
    }

    const targetNode = this.findOrgNode(step.targetOrgNodeId);
    if (!targetNode) {
      return { valid: false, reason: `org_node_not_found:${step.targetOrgNodeId}` };
    }

    // Check if target node has required capabilities
    const hasDirectCapabilities = step.requiredCapabilities.every((cap) =>
      targetNode.capabilities.includes(cap),
    );

    if (hasDirectCapabilities) {
      return { valid: true };
    }

    // R9-31: If traverseForCapabilities is enabled, look up the hierarchy
    if (this.traverseForCapabilities) {
      const foundNode = this.findNodeWithCapabilities(step.targetOrgNodeId, step.requiredCapabilities);
      if (foundNode) {
        return { valid: true };
      }
    }

    return {
      valid: false,
      reason: `missing_capabilities:${step.requiredCapabilities.join(",")}:${step.targetOrgNodeId}`,
    };
  }

  /**
   * R9-31: Group steps by org node for proper ordering
   * Steps are grouped by targetOrgNodeId and processed in topological order based on org hierarchy
   */
  private groupStepsByOrgNode(steps: readonly OrgGovernanceSagaStep[]): Map<string, OrgGovernanceSagaStep[]> {
    const groups = new Map<string, OrgGovernanceSagaStep[]>();

    for (const step of steps) {
      const existing = groups.get(step.targetOrgNodeId) ?? [];
      groups.set(step.targetOrgNodeId, [...existing, step]);
    }

    return groups;
  }

  private resolvePhase(step: Pick<OrgGovernanceSagaStep, "phase"> | undefined): OrgGovernancePhase {
    return step?.phase ?? "domain";
  }

  private sortSteps(steps: readonly OrgGovernanceSagaStep[], action: OrgGovernanceSagaStep["action"]): OrgGovernanceSagaStep[] {
    return steps
      .filter((candidate) => candidate.action === action)
      .sort((left, right) => {
        const phaseDelta = PHASE_ORDER.indexOf(this.resolvePhase(left)) - PHASE_ORDER.indexOf(this.resolvePhase(right));
        if (phaseDelta !== 0) {
          return phaseDelta;
        }
        return left.stepId.localeCompare(right.stepId);
      });
  }

  private validateHandlers(steps: readonly OrgGovernanceSagaStep[]): void {
    if (steps.some((step) => step.action === "prepare") && this.handlers.prepare == null) {
      throw new Error("missing_prepare_handler");
    }
    if (steps.some((step) => step.action === "commit") && this.handlers.commit == null) {
      throw new Error("missing_commit_handler");
    }
    if (
      (steps.some((step) => step.action === "compensate") || steps.some((step) => step.action === "commit"))
      && this.handlers.compensate == null
    ) {
      throw new Error("missing_compensate_handler");
    }
    if (steps.some((step) => step.action === "audit") && this.handlers.audit == null) {
      throw new Error("missing_audit_handler");
    }
  }

  private buildPhaseBuckets(): Record<OrgGovernancePhase, string[]> {
    return {
      identity: [],
      approval: [],
      budget: [],
      domain: [],
      agent: [],
    };
  }

  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaReceipt {
    this.validateHandlers(steps);
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaReceipt["executionLog"][number]> = [];
    let failedStepId: string | null = null;
    const commitSequenceVersion = this.nextCommitSequenceVersion++;
    const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

    for (const step of this.sortSteps(steps, "prepare")) {
      // R9-31: Validate capabilities before executing step
      const capabilityCheck = this.validateStepCapabilities(step);
      if (!capabilityCheck.valid) {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          phase: this.resolvePhase(step),
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
        break;
      }

      try {
        this.handlers.prepare?.(step, context());
        preparedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          phase: this.resolvePhase(step),
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "prepared",
        });
      } catch {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          phase: this.resolvePhase(step),
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "failed",
        });
        break;
      }
    }

    const preparedSet = new Set(preparedNodeIds);
    if (failedStepId == null) {
      for (const step of this.sortSteps(steps, "commit")) {
        if (!preparedSet.has(step.targetOrgNodeId)) {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            phase: this.resolvePhase(step),
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
            phase: this.resolvePhase(step),
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "committed",
          });
        } catch {
          failedStepId = step.stepId;
          executionLog.push({
            stepId: step.stepId,
            action: step.action,
            phase: this.resolvePhase(step),
            targetOrgNodeId: step.targetOrgNodeId,
            outcome: "failed",
          });
          break;
        }
      }
    }

    if (failedStepId != null) {
      const compensationSteps = this.sortSteps(steps, "compensate");
      const compensationNodes = [...new Set([...committedNodeIds, ...preparedNodeIds])].reverse();
      for (const nodeId of compensationNodes) {
        const phase = steps.find((candidate) => candidate.targetOrgNodeId === nodeId)?.phase;
        const compensationStep =
          compensationSteps.find((candidate) => candidate.targetOrgNodeId === nodeId)
          ?? {
            stepId: `${failedStepId}:compensate:${nodeId}`,
            action: "compensate" as const,
            targetOrgNodeId: nodeId,
            ...(phase !== undefined ? { phase } : {}),
          };
        try {
          this.handlers.compensate?.(compensationStep, context());
          compensatedNodeIds.push(nodeId);
          executionLog.push({
            stepId: compensationStep.stepId,
            action: compensationStep.action,
            phase: this.resolvePhase(compensationStep),
            targetOrgNodeId: compensationStep.targetOrgNodeId,
            outcome: "compensated",
          });
        } catch {
          executionLog.push({
            stepId: compensationStep.stepId,
            action: compensationStep.action,
            phase: this.resolvePhase(compensationStep),
            targetOrgNodeId: compensationStep.targetOrgNodeId,
            outcome: "failed",
          });
        }
      }
    } else {
      for (const step of this.sortSteps(steps, "compensate")) {
        this.handlers.compensate?.(step, context());
        compensatedNodeIds.push(step.targetOrgNodeId);
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
          phase: this.resolvePhase(step),
          targetOrgNodeId: step.targetOrgNodeId,
          outcome: "compensated",
        });
      }
    }

    for (const step of this.sortSteps(steps, "audit")) {
      this.handlers.audit?.(step, context());
      auditStepIds.push(step.stepId);
      executionLog.push({
        stepId: step.stepId,
        action: step.action,
        phase: this.resolvePhase(step),
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
      commitSequenceVersion,
    };
  }

  public executeWithReceipt(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaExtendedReceipt {
    const receipt = this.execute(sagaId, steps);
    const phaseByNodeId = new Map<string, OrgGovernancePhase>();
    const phaseByStepId = new Map<string, OrgGovernancePhase>();
    for (const step of steps) {
      const phase = this.resolvePhase(step);
      phaseByNodeId.set(step.targetOrgNodeId, phase);
      phaseByStepId.set(step.stepId, phase);
    }

    const preparedByPhase = this.buildPhaseBuckets();
    const committedByPhase = this.buildPhaseBuckets();
    const compensatedByPhase = this.buildPhaseBuckets();

    for (const nodeId of receipt.preparedNodeIds) {
      preparedByPhase[phaseByNodeId.get(nodeId) ?? "domain"].push(nodeId);
    }
    for (const nodeId of receipt.committedNodeIds) {
      committedByPhase[phaseByNodeId.get(nodeId) ?? "domain"].push(nodeId);
    }
    for (const nodeId of receipt.compensatedNodeIds) {
      compensatedByPhase[phaseByNodeId.get(nodeId) ?? "domain"].push(nodeId);
    }

    const failedPhase = receipt.failedStepId != null ? (phaseByStepId.get(receipt.failedStepId) ?? "domain") : null;

    return {
      ...receipt,
      executionLog: receipt.executionLog.map((entry) => ({
        ...entry,
        phase: phaseByStepId.get(entry.stepId) ?? phaseByNodeId.get(entry.targetOrgNodeId) ?? entry.phase ?? "domain",
      })),
      phaseCommitOrder: [...PHASE_ORDER],
      preparedByPhase,
      committedByPhase,
      compensatedByPhase,
      failedPhase,
    };
  }
}
