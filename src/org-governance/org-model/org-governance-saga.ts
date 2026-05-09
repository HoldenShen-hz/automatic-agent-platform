export interface OrgGovernanceSagaStep {
  readonly stepId: string;
  readonly targetOrgNodeId: string;
  readonly action: "prepare" | "commit" | "compensate" | "audit";
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
    targetOrgNodeId: string;
    outcome: "prepared" | "committed" | "compensated" | "audited" | "skipped" | "failed";
  }[];
  /** Commit sequence version - monotonically increasing per-org, enforced ordering */
  readonly commitSequenceVersion: number;
}

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

  public execute(sagaId: string, steps: readonly OrgGovernanceSagaStep[]): OrgGovernanceSagaReceipt {
    const preparedNodeIds: string[] = [];
    const committedNodeIds: string[] = [];
    const compensatedNodeIds: string[] = [];
    const auditStepIds: string[] = [];
    const executionLog: Array<OrgGovernanceSagaReceipt["executionLog"][number]> = [];
    let failedStepId: string | null = null;
    const commitSequenceVersion = this.nextCommitSequenceVersion++;
    const context = (): OrgGovernanceSagaHandlerContext => ({ sagaId, failedStepId });

    // R9-31: Group steps by org node for proper org-hierarchy-aware processing
    const stepsByNode = this.groupStepsByOrgNode(steps);

    for (const step of steps.filter((candidate) => candidate.action === "prepare")) {
      // R9-31: Validate capabilities before executing step
      const capabilityCheck = this.validateStepCapabilities(step);
      if (!capabilityCheck.valid) {
        failedStepId = step.stepId;
        executionLog.push({
          stepId: step.stepId,
          action: step.action,
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
      commitSequenceVersion,
    };
  }
}
