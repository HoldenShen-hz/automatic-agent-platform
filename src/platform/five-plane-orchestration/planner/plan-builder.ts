import { newId, nowIso } from "../../contracts/types/ids.js";
import type { PlannedWorkflow } from "../routing/workflow-planner.js";
import { createAssessmentRef, type Plan, type TaskSituation, type UnifiedAssessment } from "../oapeflir/types/index.js";
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
import { stableStringify } from "../../shared/cache/utils/stable-stringify.js";

const DEFAULT_PLAN_STEP_TIMEOUT_MS = 60_000;
const DEFAULT_PLAN_RETRY_BACKOFF_BASE_MS = 250;

export interface PlanBuilderInput {
  observation: TaskSituation;
  assessment: UnifiedAssessment;
  workflow: PlannedWorkflow;
  harnessRunId?: string;
  version?: number;
  parentVersion?: number;
  graphPatch?: import("../../contracts/executable-contracts/index.js").GraphPatch;
  riskProfile?: RiskPreview;
}

export interface BuildPlanOptions {
  normalizeGraph?: boolean;
  propagateRisk?: boolean;
  graphPatch?: import("../../contracts/executable-contracts/index.js").GraphPatch | null;
}

interface SourcePlanStep {
  readonly stepId?: string;
  readonly action?: string;
  readonly toolNames?: readonly string[];
  readonly title?: string;
  readonly name?: string;
  readonly ownerRoleId?: string;
  readonly roleId?: string;
  readonly inputKeys?: readonly string[];
  readonly outputKey?: string;
  readonly dependsOn?: readonly string[];
  readonly dependsOnStepIds?: readonly string[];
  readonly timeoutMs?: number;
  readonly timeout?: number;
  readonly maxAttempts?: number;
}

export class InvalidDagError extends Error {
  public readonly code = "INVALID_DAG";

  public constructor(public readonly issues: readonly string[]) {
    super(`DAG validation failed: ${issues.join("; ")}`);
    this.name = "InvalidDagError";
  }
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
  public build(input: PlanBuilderInput, options: BuildPlanOptions = {}): PlanGraphBundle & Plan {
    const workflowSteps = input.workflow.executionSteps ?? [];
    const decomposed = this.decomposition.decompose(input.workflow);
    const sourceSteps = workflowSteps.length > 0 ? workflowSteps : decomposed;
    const steps: PlanStep[] = (sourceSteps as readonly SourcePlanStep[]).map((item, index) => ({
      stepId: item.stepId ?? `step_${index + 1}`,
      action: item.action ?? item.toolNames?.[0] ?? (index === 0 ? "read" : "execute"),
      title: item.title ?? item.name ?? `Step ${index + 1}`,
      inputs: {
        ownerRoleId: item.ownerRoleId ?? item.roleId,
        inputKeys: [...(item.inputKeys ?? [])],
      },
      outputs: item.outputKey != null ? [item.outputKey] : [],
      dependencies: [...(item.dependsOn ?? item.dependsOnStepIds ?? [])],
      status: "pending",
      timeout: item.timeoutMs ?? item.timeout ?? DEFAULT_PLAN_STEP_TIMEOUT_MS,
      retryPolicy: {
        maxRetries: Math.max(0, (item.maxAttempts ?? 1) - 1),
        backoffMs: DEFAULT_PLAN_RETRY_BACKOFF_BASE_MS * (index + 1),
      },
    }));

    const dagValidation = this.dagValidator.validate(steps);

    // Reject invalid DAGs: a DAG that fails validation (cycle, missing deps, etc.)
    // cannot produce a sound execution plan and must be rejected outright.
    if (!dagValidation.valid) {
      throw new InvalidDagError(dagValidation.issues);
    }

    // R5-9: Apply graph normalization and risk propagation if enabled
    let normalizedSteps = dagValidation.orderedSteps;
    if (options.normalizeGraph) {
      const normalizationResult = this.graphNormalizer.normalize(steps, input.assessment);
      if (normalizationResult.valid) {
        normalizedSteps = normalizationResult.normalizedSteps;
      }
    }

    // R5-12: Apply graph patch if provided for replanning scenarios
    if (options.graphPatch) {
      normalizedSteps = this.applyGraphPatch(normalizedSteps, options.graphPatch);
    }

    // Convert steps to PlanNodes
    const graphSteps = normalizedSteps;
    const outputOwnerByKey = new Map<string, string>();
    for (const step of graphSteps) {
      for (const output of step.outputs ?? []) {
        outputOwnerByKey.set(output, step.stepId);
      }
    }

    const nodes: PlanNode[] = graphSteps.map((step, index) => {
      // step.inputs is Record<string, unknown>, access inputKeys property
      const inputsRecord = step.inputs as Record<string, unknown>;
      const inputKeysArray = Array.isArray(inputsRecord.inputKeys) ? inputsRecord.inputKeys as readonly string[] : [];
      const inferredDependencies = step.dependencies.length > 0
        ? [...step.dependencies]
        : inputKeysArray
            .map((key) => outputOwnerByKey.get(key))
            .filter((dependency): dependency is string => dependency != null && dependency !== step.stepId);
      const hasSideEffects = (step.outputs ?? []).length > 0;
      return {
        nodeId: step.stepId,
        nodeType: this.inferNodeType(step.action),
        inputRefs: inferredDependencies.length > 0 ? inferredDependencies : [...inputKeysArray],
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
        retryPolicyRef: `retry:plan.step.${step.stepId}`,
        timeoutMs: step.timeout,
      };
    });

    // Convert dependencies to PlanEdges
    const edges: PlanEdge[] = [];
    const stepIdToNodeId = new Map(graphSteps.map((s) => [s.stepId, s.stepId]));

    for (const step of graphSteps) {
      const inputsRecord = step.inputs as Record<string, unknown>;
      const inputKeysArray = Array.isArray(inputsRecord.inputKeys) ? inputsRecord.inputKeys as readonly string[] : [];
      const dependencyIds = step.dependencies.length > 0
        ? [...step.dependencies]
        : inputKeysArray
            .map((key) => outputOwnerByKey.get(key))
            .filter((dependency): dependency is string => dependency != null && dependency !== step.stepId);
      for (const dep of dependencyIds) {
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
      .update(stableStringify({ harnessRunId: input.harnessRunId ?? null, nodes, edges }))
      .digest("hex");

    const harnessRunId = input.harnessRunId ?? newId("hr");
    const planGraphBundleId = newId("pgb");

    // Create graph object directly (PlanGraph is an interface)
    const graph: PlanGraph = {
      graphId: newId("pg"),
      nodes,
      edges,
      entryNodeIds,
      terminalNodeIds,
      joinStrategy: "all",
      graphHash: `${input.harnessRunId ?? "harness"}:${graphHash}`,
    };

    const riskProfile: RiskPreview = input.riskProfile ?? {
      riskClass: input.assessment.risk,
      reasons: ["assessment_complete"],
    };
    const worstPath = this.dagValidator.analyzeWorstPath(normalizedSteps);

    const bundle = createPlanGraphBundle({
      planGraphBundleId,
      harnessRunId,
      graphVersion: 1,
      graph,
      schedulerPolicy: {
        policyId: "scheduler:oapeflir.deterministic_fifo",
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: `budget://plan/${planGraphBundleId}`,
      riskProfile,
      validationReport: dagValidation.valid
        ? { valid: true, findings: [] }
        : { valid: false, findings: dagValidation.issues },
      ...(worstPath == null ? {} : {
        validationReport: {
          valid: dagValidation.valid,
          findings: dagValidation.valid ? [] : dagValidation.issues,
          worstPath: {
            pathNodeIds: worstPath.pathNodeIds,
            riskClass: input.assessment.risk,
            estimatedBudgetAmount: 0,
            timeoutMs: worstPath.estimatedTimeoutMs,
          },
        },
      }),
      artifactRefs: [],
      createdAt: nowIso(),
    });
    return Object.assign(bundle, {
      planId: `plan:${planGraphBundleId}`,
      taskId: input.observation.taskId,
      version: input.version ?? 1,
      assessmentRef: createAssessmentRef(input.assessment),
      strategy: (input.version ?? 1) > 1 ? "replanned" : this.strategySelector.select(input),
      steps: normalizedSteps,
      createdAt: Date.parse(bundle.createdAt),
      ...(input.parentVersion != null ? { parentVersion: input.parentVersion } : {}),
    } satisfies Plan);
  }

  public buildGraphBundle(input: PlanBuilderInput, options: BuildPlanOptions = {}): PlanGraphBundle {
    return this.build(input, options);
  }

  /**
   * Replans from a previous PlanGraphBundle.
   */
  public replan(previousPlan: PlanGraphBundle | Plan, input: Omit<PlanBuilderInput, "version" | "parentVersion">, options: BuildPlanOptions = {}): PlanGraphBundle & Plan {
    const previousVersion = "graphVersion" in previousPlan ? previousPlan.graphVersion : previousPlan.version;
    return this.build({
      ...input,
      version: previousVersion + 1,
      parentVersion: previousVersion,
    }, options);
  }

  /**
   * R5-12: Applies a GraphPatch to the steps for replanning scenarios per §13.13.
   * This integrates the patch operations (add/remove/modify nodes) into the plan.
   */
  private applyGraphPatch(steps: PlanStep[], graphPatch: import("../../contracts/executable-contracts/index.js").GraphPatch): PlanStep[] {
    // R5-12: Create a map of step IDs to steps for efficient lookup
    const stepMap = new Map(steps.map((s) => [s.stepId, s]));

    // R5-12: Apply each operation in the patch
    const patchedSteps = [...steps];
    for (const op of graphPatch.operations) {
      switch (op.operationType) {
        case "add_node": {
          // R5-12: Add a new node from the patch payload
          const payload = op.payload as Record<string, unknown>;
          const newStep: PlanStep = {
            stepId: payload.stepId as string,
            action: payload.action as string,
            title: (payload.title as string) ?? `Step ${payload.stepId}`,
            inputs: (payload.inputs as Record<string, unknown>) ?? {},
            outputs: (payload.outputs as string[]) ?? [],
            dependencies: (payload.dependencies as string[]) ?? [],
            status: "pending",
            timeout: (payload.timeout as number) ?? DEFAULT_PLAN_STEP_TIMEOUT_MS,
            retryPolicy: { maxRetries: 0, backoffMs: DEFAULT_PLAN_RETRY_BACKOFF_BASE_MS },
          };
          // R5-12: Insert after the target ref or at the end
          const targetIdx = patchedSteps.findIndex((s) => s.stepId === op.targetRef);
          if (targetIdx >= 0) {
            patchedSteps.splice(targetIdx + 1, 0, newStep);
          } else {
            patchedSteps.push(newStep);
          }
          break;
        }
        case "add_edge": {
          // R5-12: Add an edge between existing nodes
          const payload = op.payload as Record<string, unknown>;
          const fromNode = payload.fromNodeId as string;
          const toNode = payload.toNodeId as string;
          // R5-12: Update dependencies of target node to include the new predecessor
          const targetStep = patchedSteps.find((s) => s.stepId === op.targetRef);
          if (targetStep && !targetStep.dependencies.includes(fromNode)) {
            targetStep.dependencies = [...targetStep.dependencies, fromNode];
          }
          // R5-12: Also add the new step as a dependency for the toNode if it exists
          const toStep = patchedSteps.find((s) => s.stepId === toNode);
          if (toStep && !toStep.dependencies.includes(fromNode)) {
            toStep.dependencies = [...toStep.dependencies, fromNode];
          }
          break;
        }
        case "append_subgraph": {
          // R5-12: Append a subgraph of steps from the patch payload
          const payload = op.payload as { steps?: PlanStep[] };
          if (Array.isArray(payload.steps)) {
            patchedSteps.push(...payload.steps);
          }
          break;
        }
        case "mark_skipped": {
          // R5-12: Mark a step as skipped
          const skippedStep = patchedSteps.find((s) => s.stepId === op.targetRef);
          if (skippedStep) {
            (skippedStep as Record<string, unknown>).status = "skipped";
          }
          break;
        }
        case "disable_edge": {
          // R5-12: Remove an edge between nodes
          const payload = op.payload as Record<string, unknown>;
          const fromNode = payload.fromNodeId as string;
          const toNode = payload.toNodeId as string;
          // R5-12: Remove the dependency from the target node
          const targetStep = patchedSteps.find((s) => s.stepId === op.targetRef);
          if (targetStep) {
            targetStep.dependencies = targetStep.dependencies.filter((d) => d !== fromNode);
          }
          break;
        }
        default:
          // R5-12: Unknown operation types are ignored (prevents compilation errors for unused cases)
          break;
      }
    }
    return patchedSteps;
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
