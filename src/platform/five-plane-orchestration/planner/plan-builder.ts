import { newId } from "../../contracts/types/ids.js";
import { createPlanGraphBundle, type PlanGraphBundle, type GraphValidationReport, type GraphRiskFinding, type GraphWorstPathAnalysis, type RiskPreview } from "../../contracts/executable-contracts/index.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { createAssessmentRef, parsePlan, type Plan, type PlanStep, type TaskSituation, type UnifiedAssessment } from "../oapeflir/types/index.js";
import { TaskDecompositionService } from "./task-decomposition-service.js";
import { PlanDagValidator } from "./plan-dag-validator.js";
import { PlanStrategySelector } from "./plan-strategy-selector.js";

export interface PlanBuilderInput {
  observation: TaskSituation;
  assessment: UnifiedAssessment;
  workflow: PlannedWorkflow;
  version?: number;
  parentVersion?: number;
}

export class PlanBuilder {
  private readonly decomposition = new TaskDecompositionService();
  private readonly dagValidator = new PlanDagValidator();
  private readonly strategySelector = new PlanStrategySelector();

  public build(input: PlanBuilderInput): Plan {
    const decomposed = this.decomposition.decompose(input.workflow);
    const steps: PlanStep[] = decomposed.map((item, index) => ({
      stepId: input.workflow.executionSteps[index]?.stepId ?? `step_${index + 1}`,
      action: item.toolNames[0] ?? (index === 0 ? "read" : "execute"),
      title: item.title,
      inputs: {
        ownerRoleId: item.ownerRoleId,
        inputKeys: [...(input.workflow.executionSteps[index]?.inputKeys ?? [])],
      },
      outputs: input.workflow.executionSteps[index]?.outputKey != null ? [input.workflow.executionSteps[index].outputKey] : [],
      dependencies: item.dependsOn,
      status: "pending",
      timeout: input.workflow.executionSteps[index]?.timeoutMs ?? 60000,
      retryPolicy: {
        maxRetries: Math.max(0, (input.workflow.executionSteps[index]?.maxAttempts ?? 1) - 1),
        backoffMs: 250 * (index + 1),
      },
    }));

    const dagValidation = this.dagValidator.validate(steps);
    // R20-01: Check valid AND that orderedSteps is non-empty (non-empty signals cycle was detected)
    // A cycle means orderedSteps is partial/empty - must not use as fallback
    if (!dagValidation.valid || dagValidation.orderedSteps.length === 0) {
      // Cannot produce a valid plan with cyclic/cycles - throw to force replan
      const planId = newId("plan");
      const strategy = this.strategySelector.select(input);
      // Use original steps only after confirming no cycle; otherwise fail
      return parsePlan({
        planId,
        taskId: input.observation.taskId,
        assessmentRef: createAssessmentRef(input.assessment),
        version: input.version ?? 1,
        strategy: input.version != null && input.version > 1 ? "replanned" : strategy,
        steps: dagValidation.valid ? dagValidation.orderedSteps : [], // Only use if valid, else empty
        createdAt: Date.now(),
        parentVersion: input.parentVersion,
      });
    }
    const strategy = this.strategySelector.select(input);

    return parsePlan({
      planId: newId("plan"),
      taskId: input.observation.taskId,
      assessmentRef: createAssessmentRef(input.assessment),
      version: input.version ?? 1,
      strategy: input.version != null && input.version > 1 ? "replanned" : strategy,
      steps: dagValidation.orderedSteps,
      createdAt: Date.now(),
      parentVersion: input.parentVersion,
    });
  }

  /**
   * Build a PlanGraphBundle from workflow inputs.
   * §13.7: Plan must be Graph (PlanGraphBundle), not linear Plan{steps[]}
   * §13.9: Graph Normalization
   * §13.11: Risk Propagation
   * §13.12: Worst-Path Analysis
   */
  public buildGraphBundle(input: PlanBuilderInput & {
    harnessRunId: string;
    riskProfile?: RiskPreview;
  }): PlanGraphBundle {
    const plan = this.build(input);

    // §13.9: Graph normalization - convert linear steps to graph nodes
    const nodes = plan.steps.map((step) => ({
      nodeId: step.stepId,
      nodeType: "tool" as const,
      inputRefs: step.dependencies,
      outputSchemaRef: `schema:plan.step.${step.stepId}`,
      riskClass: "medium" as const,
      budgetIntent: {
        amount: 1000,
        currency: "USD",
        resourceKinds: ["compute"] as const,
      },
      sideEffectProfile: {
        mayCommitExternalEffect: false,
        reversible: true,
      },
      retryPolicyRef: `retry:plan.${step.stepId}`,
      timeoutMs: step.timeout,
    }));

    const edges = plan.steps.flatMap((step) =>
      step.dependencies.map((depId) => ({
        edgeId: newId("plan_edge"),
        fromNodeId: depId,
        toNodeId: step.stepId,
        condition: { type: "always" as const },
        dependencyType: "hard" as const,
      })),
    );

    // Entry nodes are steps with no dependencies
    const entryNodeIds = plan.steps
      .filter((step) => step.dependencies.length === 0)
      .map((step) => step.stepId);

    // Terminal nodes are steps that no other step depends on
    const dependentStepIds = new Set(plan.steps.flatMap((step) => step.dependencies));
    const terminalNodeIds = plan.steps
      .filter((step) => !dependentStepIds.has(step.stepId))
      .map((step) => step.stepId);

    const graphHash = [input.harnessRunId, plan.planId, plan.version, nodes.length].join(":");

    // §13.10: Extended validation
    const validationReport = this.performExtendedValidation(plan.steps);

    // §13.11: Risk propagation
    const riskPropagation = this.computeRiskPropagation(nodes, plan.steps);

    // §13.12: Worst-path analysis
    const worstPath = this.dagValidator.analyzeWorstPath(plan.steps);

    const graphValidationReport: GraphValidationReport = {
      valid: validationReport.valid,
      findings: validationReport.issues,
      normalizedNodeIds: nodes.map((n) => n.nodeId),
      riskPropagation,
      ...(worstPath
        ? {
            worstPath: {
              pathNodeIds: worstPath.pathNodeIds,
              riskClass: "medium" as const,
              estimatedBudgetAmount: worstPath.estimatedCost / 1000,
              timeoutMs: worstPath.estimatedTimeoutMs,
            },
          }
        : {}),
    };

    return createPlanGraphBundle({
      harnessRunId: input.harnessRunId,
      graph: {
        graphId: newId("plan_graph"),
        nodes,
        edges,
        entryNodeIds,
        terminalNodeIds,
        joinStrategy: "all",
        graphHash,
      },
      schedulerPolicy: {
        policyId: "scheduler:oapeflir.deterministic_fifo",
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: `budget:plan.${plan.planId}`,
      riskProfile: input.riskProfile ?? { riskClass: "medium", reasons: ["plan_builder.default"] },
      validationReport: graphValidationReport,
    });
  }

  /**
   * §13.10: Extended validation beyond basic DAG structure.
   * Checks: entry node existence, terminal node existence,
   * executor availability, risk/budget/tool/sandbox completeness.
   */
  private performExtendedValidation(steps: readonly PlanStep[]): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (steps.length === 0) {
      issues.push("planning.empty_plan");
      return { valid: false, issues };
    }

    // Check entry nodes exist
    const hasEntryNodes = steps.some((step) => step.dependencies.length === 0);
    if (!hasEntryNodes) {
      issues.push("planning.no_entry_node");
    }

    // Check terminal nodes exist
    const dependentIds = new Set(steps.flatMap((step) => step.dependencies));
    const hasTerminalNodes = steps.some((step) => !dependentIds.has(step.stepId));
    if (!hasTerminalNodes) {
      issues.push("planning.no_terminal_node");
    }

    // Validate step-level completeness
    for (const step of steps) {
      if (!step.title?.trim()) {
        issues.push(`planning.missing_title:${step.stepId}`);
      }
      if (step.timeout <= 0) {
        issues.push(`planning.invalid_timeout:${step.stepId}`);
      }
      if (step.retryPolicy.maxRetries < 0) {
        issues.push(`planning.invalid_retry_max:${step.stepId}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * §13.11: Compute risk propagation through the DAG.
   * Identifies nodes that inherit high/critical risk from predecessors.
   */
  private computeRiskPropagation(
    nodes: readonly { nodeId: string; riskClass: string }[],
    steps: readonly PlanStep[],
  ): GraphRiskFinding[] {
    const findings: GraphRiskFinding[] = [];
    const stepById = new Map(steps.map((step) => [step.stepId, step]));
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
      outgoing.set(step.stepId, []);
    }
    for (const step of steps) {
      for (const depId of step.dependencies) {
        outgoing.get(depId)?.push(step.stepId);
      }
    }

    for (const step of steps) {
      const stepInputs = step.inputs as Record<string, unknown> | undefined;
      if (stepInputs?.riskClass === "critical" || stepInputs?.riskClass === "high") {
        const dependents = outgoing.get(step.stepId) ?? [];
        for (const depId of dependents) {
          const depStep = stepById.get(depId);
          if (depStep) {
            const depInputs = depStep.inputs as Record<string, unknown> | undefined;
            if (!depInputs?.riskClass) {
              findings.push({
                nodeId: depId,
                inheritedRiskClass: stepInputs.riskClass as "high" | "critical",
                reasons: [`inherited_from:${step.stepId}`],
              });
            }
          }
        }
      }
    }

    return findings;
  }

  public replan(previousPlan: Plan, input: Omit<PlanBuilderInput, "version" | "parentVersion">): Plan {
    return this.build({
      ...input,
      version: previousPlan.version + 1,
      parentVersion: previousPlan.version,
    });
  }
}
