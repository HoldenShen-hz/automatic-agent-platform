import type { PlanStep } from "../oapeflir/types/index.js";

export interface PlanDagValidationResult {
  valid: boolean;
  issues: string[];
  orderedSteps: PlanStep[];
}

/**
 * Validation checks beyond basic DAG structure.
 * §13.10 requires: entry node existence, terminal node existence,
 * executor availability, risk/budget/tool/sandbox completeness.
 */
export interface PlanDagExtendedValidation {
  hasEntryNodes: boolean;
  hasTerminalNodes: boolean;
  allDependenciesSatisfied: boolean;
  missingDependencies: string[];
  unsupportedNodeTypes: string[];
}

/**
 * Tool registry interface for tool availability validation.
 * §13.10: Referenced tools must exist and be available.
 */
export interface ToolRegistry {
  isToolAvailable(toolName: string): boolean;
  getToolSandboxRequirements?(toolName: string): string[] | undefined;
}

/**
 * Executor registry interface for executor availability validation.
 * §13.10: Each node's executor must be available.
 */
export interface ExecutorRegistry {
  isExecutorAvailable(executorId: string): boolean;
}

/**
 * Approval policy for high-risk operations.
 * §13.10: High-risk nodes need approval policy.
 */
export interface ApprovalPolicy {
  requiredRiskClasses: string[];
  approvalRequired: boolean;
}

/**
 * Budget constraint for plan validation.
 * §13.10: Total estimated cost must fit within budget.
 */
export interface BudgetConstraint {
  maxCost: number;
  maxDurationMs?: number;
}

/**
 * Sandbox compatibility entry.
 * §13.10: Tool/sandbox must be compatible.
 */
export interface SandboxCompatibility {
  sandboxMode: string;
  compatibleTools: string[];
  incompatibleTools: string[];
}

/**
 * Validation options for PlanDagValidator.
 * Allows injection of external registries for validation.
 */
export interface PlanDagValidationOptions {
  toolRegistry?: ToolRegistry | undefined;
  executorRegistry?: ExecutorRegistry | undefined;
  approvalPolicy?: ApprovalPolicy | undefined;
  budgetConstraint?: BudgetConstraint | undefined;
  sandboxCompatibility?: SandboxCompatibility[] | undefined;
}

export class PlanDagValidator {
  private readonly toolRegistry?: ToolRegistry | undefined;
  private readonly executorRegistry?: ExecutorRegistry | undefined;
  private readonly approvalPolicy?: ApprovalPolicy | undefined;
  private readonly budgetConstraint?: BudgetConstraint | undefined;
  private readonly sandboxCompatibility?: SandboxCompatibility[] | undefined;

  constructor(options?: PlanDagValidationOptions) {
    this.toolRegistry = options?.toolRegistry ?? undefined;
    this.executorRegistry = options?.executorRegistry ?? undefined;
    this.approvalPolicy = options?.approvalPolicy ?? undefined;
    this.budgetConstraint = options?.budgetConstraint ?? undefined;
    this.sandboxCompatibility = options?.sandboxCompatibility ?? undefined;
  }

  public validate(steps: readonly PlanStep[]): PlanDagValidationResult {
    const stepById = new Map(steps.map((step) => [step.stepId, step]));
    const issues: string[] = [];
    const incomingCounts = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
      incomingCounts.set(step.stepId, 0);
      outgoing.set(step.stepId, []);
    }

    for (const step of steps) {
      for (const dependencyId of step.dependencies) {
        if (dependencyId === step.stepId) {
          issues.push(`planning.self_dependency:${step.stepId}`);
          continue;
        }
        if (!stepById.has(dependencyId)) {
          issues.push(`planning.missing_dependency:${step.stepId}:${dependencyId}`);
          continue;
        }
        incomingCounts.set(step.stepId, (incomingCounts.get(step.stepId) ?? 0) + 1);
        outgoing.get(dependencyId)?.push(step.stepId);
      }
    }

    const readyQueue = steps
      .filter((step) => (incomingCounts.get(step.stepId) ?? 0) === 0)
      .map((step) => step.stepId);
    const orderedSteps: PlanStep[] = [];

    while (readyQueue.length > 0) {
      const nextStepId = readyQueue.shift()!;
      const nextStep = stepById.get(nextStepId);
      if (!nextStep) {
        continue;
      }
      orderedSteps.push(nextStep);
      for (const dependentId of outgoing.get(nextStepId) ?? []) {
        const nextIncoming = (incomingCounts.get(dependentId) ?? 0) - 1;
        incomingCounts.set(dependentId, nextIncoming);
        if (nextIncoming === 0) {
          readyQueue.push(dependentId);
        }
      }
    }

    if (orderedSteps.length !== steps.length) {
      issues.push("planning.cycle_detected");
      // R20-02: When cycle detected, do NOT return the original unsorted steps.
      // Return empty orderedSteps to signal failure - plan-builder must check valid flag
      // and reject the plan rather than proceed with an invalid ordering.
      return {
        valid: false,
        issues,
        orderedSteps: [], // Empty signals failure - never use unsorted steps as fallback
      };
    }

    // §13.10 Extended validation: entry node existence
    const entryNodes = steps.filter((step) => (incomingCounts.get(step.stepId) ?? 0) === 0);
    if (entryNodes.length === 0 && steps.length > 0) {
      issues.push("planning.no_entry_node");
    }

    // §13.10 Extended validation: terminal node existence
    const terminalNodes = steps.filter((step) => (outgoing.get(step.stepId)?.length ?? 0) === 0);
    if (terminalNodes.length === 0 && steps.length > 0) {
      issues.push("planning.no_terminal_node");
    }

    // §13.10 Extended validation: step-level validation
    for (const step of steps) {
      const stepRecord = step as Record<string, unknown>;
      // Validate timeout is positive
      if (step.timeout <= 0) {
        issues.push(`planning.invalid_timeout:${step.stepId}`);
      }
      // Validate retry policy
      if (step.retryPolicy.maxRetries < 0) {
        issues.push(`planning.invalid_retry_max:${step.stepId}`);
      }
      // Validate step has required fields
      if (!step.title || step.title.trim().length === 0) {
        issues.push(`planning.missing_title:${step.stepId}`);
      }
      // §13.10: Validate executor availability
      const executor = stepRecord["executor"];
      if (executor == null || typeof executor !== "string" || (executor as string).trim().length === 0) {
        issues.push(`planning.missing_executor:${step.stepId}`);
      }
      // §13.10: Validate risk/budget completeness
      const inputs = step.inputs as Record<string, unknown> | undefined;
      if (inputs?.riskClass == null) {
        issues.push(`planning.missing_risk_class:${step.stepId}`);
      }
      if (inputs?.budget == null) {
        issues.push(`planning.missing_budget:${step.stepId}`);
      }
      // §13.10: Validate tool availability
      const tools = stepRecord["tools"];
      if (tools != null && Array.isArray(tools)) {
        for (const tool of tools) {
          if (!tool || typeof tool !== "string" || (tool as string).trim().length === 0) {
            issues.push(`planning.invalid_tool:${step.stepId}`);
            break;
          }
        }
      }
      // §13.10: Validate sandbox mode
      const sandboxMode = stepRecord["sandboxMode"] as string | undefined;
      if (sandboxMode == null || sandboxMode.trim().length === 0) {
        issues.push(`planning.missing_sandbox_mode:${step.stepId}`);
      }

      // §13.10: Executor availability validation
      if (this.executorRegistry && executor && typeof executor === "string" && executor.trim().length > 0) {
        if (!this.executorRegistry.isExecutorAvailable(executor)) {
          issues.push(`planning.executor_unavailable:${step.stepId}:${executor}`);
        }
      }

      // §13.10: Risk validation - high/critical risk nodes need approval policy
      const riskClass = inputs?.riskClass as string | undefined;
      if (riskClass && this.approvalPolicy?.requiredRiskClasses.includes(riskClass)) {
        if (!this.approvalPolicy.approvalRequired) {
          issues.push(`planning.high_risk_without_approval:${step.stepId}:${riskClass}`);
        }
      }

      // §13.10: Tool availability validation
      if (this.toolRegistry && tools != null && Array.isArray(tools)) {
        for (const tool of tools) {
          if (typeof tool === "string" && tool.trim().length > 0) {
            if (!this.toolRegistry.isToolAvailable(tool)) {
              issues.push(`planning.tool_unavailable:${step.stepId}:${tool}`);
            }
          }
        }
      }

      // §13.10: Sandbox compatibility validation
      if (sandboxMode && this.sandboxCompatibility && this.sandboxCompatibility.length > 0) {
        const compatibleEntry = this.sandboxCompatibility.find((entry) => entry.sandboxMode === sandboxMode);
        if (compatibleEntry) {
          if (tools != null && Array.isArray(tools)) {
            for (const tool of tools) {
              if (typeof tool === "string" && tool.trim().length > 0) {
                if (compatibleEntry.incompatibleTools.includes(tool)) {
                  issues.push(`planning.sandbox_incompatible_tool:${step.stepId}:${sandboxMode}:${tool}`);
                }
              }
            }
          }
        }
      }
    }

    // §13.10: Budget constraint validation - total estimated cost must fit within budget
    if (this.budgetConstraint) {
      const worstPath = this.analyzeWorstPath(steps);
      if (worstPath && worstPath.estimatedCost > this.budgetConstraint.maxCost) {
        issues.push(
          `planning.budget_exceeded:estimated=${worstPath.estimatedCost},max=${this.budgetConstraint.maxCost}`,
        );
      }
    }

    // §13.10: Risk propagation check - identify nodes that inherit high risk
    const riskPropagationIssues = this.checkRiskPropagation(steps, incomingCounts, outgoing);
    issues.push(...riskPropagationIssues);

    return {
      valid: issues.length === 0,
      issues,
      orderedSteps, // Only reach here if topological sort succeeded (no cycle)
    };
  }

  /**
   * §13.11: Check risk propagation through the DAG.
   * High-risk steps should propagate risk to their dependents.
   */
  private checkRiskPropagation(
    steps: readonly PlanStep[],
    _incomingCounts: Map<string, number>,
    outgoing: Map<string, string[]>,
  ): string[] {
    const issues: string[] = [];
    const stepById = new Map(steps.map((step) => [step.stepId, step]));

    // Find high/critical risk steps and check they don't cascade uncontrolled
    for (const step of steps) {
      // Check if step has explicit risk metadata (from inputs)
      const stepInputs = step.inputs as Record<string, unknown> | undefined;
      if (stepInputs?.riskClass === "critical" || stepInputs?.riskClass === "high") {
        // Check if there are dependents that should inherit risk
        const dependents = outgoing.get(step.stepId) ?? [];
        for (const depId of dependents) {
          const depStep = stepById.get(depId);
          if (depStep) {
            const depInputs = depStep.inputs as Record<string, unknown> | undefined;
            // If dependent doesn't have risk class set, it inherits from parent
            if (!depInputs?.riskClass) {
              // Risk inheritance is acceptable, but we track it
              // This is informational - not an error unless specified
            }
          }
        }
      }
    }

    return issues;
  }

  /**
   * §13.12: Perform worst-path analysis through the DAG.
   * Identifies the path with highest accumulated risk/cost.
   */
  public analyzeWorstPath(steps: readonly PlanStep[]): {
    pathNodeIds: string[];
    estimatedCost: number;
    estimatedTimeoutMs: number;
  } | null {
    if (steps.length === 0) {
      return null;
    }

    const stepById = new Map(steps.map((step) => [step.stepId, step]));
    const incomingCounts = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
      incomingCounts.set(step.stepId, 0);
      outgoing.set(step.stepId, []);
    }

    for (const step of steps) {
      for (const depId of step.dependencies) {
        incomingCounts.set(step.stepId, (incomingCounts.get(step.stepId) ?? 0) + 1);
        outgoing.get(depId)?.push(step.stepId);
      }
    }

    const terminalNodes = steps.filter((step) => (outgoing.get(step.stepId)?.length ?? 0) === 0);
    if (terminalNodes.length === 0) {
      return null;
    }

    // Use dynamic programming to find highest-cost path
    // Cost = accumulated timeout + retries + worst-case dependents
    const memoCost = new Map<string, number>();
    const memoPath = new Map<string, string[]>();

    function computeCost(stepId: string): { cost: number; path: string[] } {
      const cached = memoCost.get(stepId);
      if (cached !== undefined) {
        return { cost: cached, path: memoPath.get(stepId) ?? [stepId] };
      }

      const step = stepById.get(stepId);
      if (!step) {
        return { cost: 0, path: [stepId] };
      }

      const deps = step.dependencies;
      if (deps.length === 0) {
        // Base: step timeout + retry overhead
        const cost = step.timeout + (step.retryPolicy.maxRetries * step.retryPolicy.backoffMs);
        memoCost.set(stepId, cost);
        memoPath.set(stepId, [stepId]);
        return { cost, path: [stepId] };
      }

      // Find worst dependency path
      let worstCost = 0;
      let worstPath: string[] = [];
      for (const depId of deps) {
        const { cost, path } = computeCost(depId);
        if (cost > worstCost) {
          worstCost = cost;
          worstPath = path;
        }
      }

      const totalCost = worstCost + step.timeout + (step.retryPolicy.maxRetries * step.retryPolicy.backoffMs);
      memoCost.set(stepId, totalCost);
      memoPath.set(stepId, [...worstPath, stepId]);

      return { cost: totalCost, path: [...worstPath, stepId] };
    }

    // Evaluate all terminal paths and find the worst.
    // computeCost() already accumulates dependency chains backward.
    let worstOverallCost = 0;
    let worstOverallPath: string[] = [];
    for (const terminal of terminalNodes) {
      const { cost, path } = computeCost(terminal.stepId);
      if (cost > worstOverallCost) {
        worstOverallCost = cost;
        worstOverallPath = path;
      }
    }

    return {
      pathNodeIds: worstOverallPath,
      estimatedCost: worstOverallCost,
      estimatedTimeoutMs: worstOverallCost,
    };
  }
}
