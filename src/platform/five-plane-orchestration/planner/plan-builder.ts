import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { createAssessmentRef, type TaskSituation, type UnifiedAssessment } from "../oapeflir/types/index.js";
import { TaskDecompositionService } from "./task-decomposition-service.js";
import { PlanDagValidator } from "./plan-dag-validator.js";
import { PlanStrategySelector } from "./plan-strategy-selector.js";
import { PlanGraphNormalizer } from "./plan-graph-normalizer.js";
import {
  createPlanGraphBundle,
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type RiskPreview,
} from "../../contracts/executable-contracts/index.js";
import { createHash } from "node:crypto";
import type { PlanStep } from "../oapeflir/types/index.js";

export interface PlanBuilderInput {
  observation: TaskSituation;
  assessment: UnifiedAssessment;
  workflow: PlannedWorkflow;
  version?: number;
  parentVersion?: number;
}

export interface BuildPlanOptions {
  normalizeGraph?: boolean;
  propagateRisk?: boolean;
}

export class PlanBuilder {
  private readonly decomposition = new TaskDecompositionService();
  private readonly dagValidator = new PlanDagValidator();
  private readonly strategySelector = new PlanStrategySelector();
  private readonly graphNormalizer = new PlanGraphNormalizer();

  /**
   * Builds a PlanGraphBundle from the workflow input.
   * This is the canonical output format per R8-03 replacing legacy Plan(steps array).
   */
  public build(input: PlanBuilderInput, options: BuildPlanOptions = {}): PlanGraphBundle {
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

    // R5-9: Apply graph normalization and risk propagation if enabled
    let normalizedSteps = dagValidation.orderedSteps;
    if (options.normalizeGraph) {
      const normalizationResult = this.graphNormalizer.normalize(steps, input.assessment);
      if (normalizationResult.valid) {
        normalizedSteps = normalizationResult.normalizedSteps;
      }
    }

    // Convert steps to PlanNodes
    const nodes: PlanNode[] = normalizedSteps.map((step, index) => {
      // step.inputs is Record<string, unknown>, access inputKeys property
      const inputsRecord = step.inputs as Record<string, unknown>;
      const inputKeysArray = Array.isArray(inputsRecord.inputKeys) ? inputsRecord.inputKeys as readonly string[] : [];
      const hasSideEffects = (step.outputs ?? []).length > 0;
      return {
        nodeId: step.stepId,
        nodeType: this.inferNodeType(step.action),
        inputRefs: inputKeysArray,
        outputSchemaRef: `output://${step.stepId}`,
        riskClass: input.assessment.risk,
        budgetIntent: {
          amount: 0.01,
          currency: "USD",
          resourceKinds: ["token"],
        },
        sideEffectProfile: {
          mayCommitExternalEffect: hasSideEffects,
          reversible: false,
        },
        retryPolicyRef: `retry://${step.stepId}`,
        timeoutMs: step.timeout,
      };
    });

    // Convert dependencies to PlanEdges
    const edges: PlanEdge[] = [];
    const stepIdToNodeId = new Map(normalizedSteps.map((s) => [s.stepId, s.stepId]));

    for (const step of normalizedSteps) {
      for (const dep of step.dependencies ?? []) {
        const depNodeId = stepIdToNodeId.get(dep);
        if (depNodeId) {
          edges.push({
            edgeId: `edge:${depNodeId}:${step.stepId}`,
            fromNodeId: depNodeId,
            toNodeId: step.stepId,
            condition: true,
            dependencyType: "hard",
          });
        }
      }
    }

    // Compute entry and terminal node IDs
    const entryNodeIds = nodes
      .filter((n) => !edges.some((e) => e.toNodeId === n.nodeId))
      .map((n) => n.nodeId);
    const terminalNodeIds = nodes
      .filter((n) => !edges.some((e) => e.fromNodeId === n.nodeId))
      .map((n) => n.nodeId);

    // Compute graph hash
    const graphHash = createHash("sha256")
      .update(JSON.stringify({ nodes, edges }))
      .digest("hex");

    const harnessRunId = newId("hr");
    const planGraphBundleId = newId("pgb");

    // Create graph object directly (PlanGraph is an interface)
    const graph: PlanGraph = {
      graphId: newId("pg"),
      nodes,
      edges,
      entryNodeIds,
      terminalNodeIds,
      joinStrategy: "all",
      graphHash,
    };

    const riskProfile: RiskPreview = {
      riskClass: input.assessment.risk,
      reasons: ["assessment_complete"],
    };

    return createPlanGraphBundle({
      planGraphBundleId,
      harnessRunId,
      graph,
      schedulerPolicy: {
        policyId: newId("sp"),
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: `budget://${planGraphBundleId}`,
      riskProfile,
      validationReport: dagValidation.valid
        ? { valid: true, findings: [] }
        : { valid: false, findings: dagValidation.issues },
      artifactRefs: [],
      createdAt: nowIso(),
    });
  }

  /**
   * Replans from a previous PlanGraphBundle.
   */
  public replan(previousPlan: PlanGraphBundle, input: Omit<PlanBuilderInput, "version" | "parentVersion">, options: BuildPlanOptions = {}): PlanGraphBundle {
    return this.build({
      ...input,
      version: previousPlan.graphVersion + 1,
      parentVersion: previousPlan.graphVersion,
    }, options);
  }

  private inferNodeType(action: string): PlanNode["nodeType"] {
    if (action.includes("llm") || action.includes("model")) {
      return "llm";
    }
    if (action.includes("tool") || action.includes("execute")) {
      return "tool";
    }
    if (action.includes("wait") || action.includes("hitl")) {
      return "hitl_wait";
    }
    if (action.includes("subgraph")) {
      return "subgraph";
    }
    if (action.includes("evaluator")) {
      return "evaluator";
    }
    if (action.includes("router") || action.includes("route")) {
      return "router";
    }
    if (action.includes("compensate")) {
      return "compensation";
    }
    return "tool";
  }
}
