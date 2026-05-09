import { createHash } from "node:crypto";

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import {
  createPlanGraphBundle,
  type GraphRiskFinding,
  type GraphWorstPathAnalysis,
  type PlanEdge,
  type PlanGraphBundle,
  type PlanNode,
  type PlanNodeType,
  type RiskClass,
} from "../../platform/contracts/executable-contracts/index.js";
import type { RuntimeLifecycleRepository } from "../../platform/five-plane-state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { applyInteractionTemplate, type InteractionTemplate } from "./template-engine/index.js";
import { canAdvanceWizard, type WizardSession, type WizardStep } from "./wizard/index.js";
import type {
  DomainOnboardingWizard,
  VisualWorkflowBuilder,
  DraggableComponent,
  ComponentCategory,
  WorkflowPreview,
} from "./onboarding/index.js";

/**
 * Record representing a persisted workflow builder definition.
 * Stored via RuntimeLifecycleRepository using the workflow_state table.
 */
export interface WorkflowBuilderRecord {
  readonly draftId: string;
  readonly taskId: string;
  readonly builderJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Repository interface for persisting workflow builder data.
 * Provides durable storage for visual workflow definitions.
 */
export interface WorkflowBuilderRepository {
  saveWorkflow(record: WorkflowBuilderRecord): void;
  loadWorkflow(draftId: string): WorkflowBuilderRecord | null;
  listWorkflows(limit?: number): readonly WorkflowBuilderRecord[];
  deleteWorkflow(draftId: string): boolean;
}

/**
 * In-memory implementation of WorkflowBuilderRepository for testing and development.
 * Implements the same interface as the durable repository for drop-in replacement.
 */
export class InMemoryWorkflowBuilderRepository implements WorkflowBuilderRepository {
  private readonly store = new Map<string, WorkflowBuilderRecord>();

  public saveWorkflow(record: WorkflowBuilderRecord): void {
    this.store.set(record.draftId, record);
  }

  public loadWorkflow(draftId: string): WorkflowBuilderRecord | null {
    return this.store.get(draftId) ?? null;
  }

  public listWorkflows(limit?: number): readonly WorkflowBuilderRecord[] {
    const all = [...this.store.values()].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    return limit != null ? all.slice(0, limit) : all;
  }

  public deleteWorkflow(draftId: string): boolean {
    return this.store.delete(draftId);
  }
}

/**
 * Durable implementation of WorkflowBuilderRepository using RuntimeLifecycleRepository.
 * Persists workflow builder definitions to the state-evidence layer.
 */
export class DurableWorkflowBuilderRepository implements WorkflowBuilderRepository {
  public constructor(
    private readonly runtimeRepository: RuntimeLifecycleRepository,
    private readonly options: { readonly prefix?: string } = {},
  ) {}

  public saveWorkflow(record: WorkflowBuilderRecord): void {
    const now = nowIso();
    // Use the runtime repository's updateWorkflowState to persist the builder JSON
    // We encode the draftId in the taskId and store the builder JSON as outputsJson
    this.runtimeRepository.updateWorkflowState(
      record.taskId,
      "draft",
      0,
      JSON.stringify({
        draftId: record.draftId,
        builderJson: record.builderJson,
        createdAt: record.createdAt,
      }),
      now,
      record.draftId,
    );
  }

  public loadWorkflow(draftId: string): WorkflowBuilderRecord | null {
    const workflowState = this.runtimeRepository.getWorkflowState(draftId);
    if (workflowState == null) {
      return null;
    }
    try {
      const outputs = JSON.parse(workflowState.outputsJson);
      return {
        draftId: outputs.draftId ?? draftId,
        taskId: workflowState.taskId,
        builderJson: outputs.builderJson ?? "{}",
        createdAt: outputs.createdAt ?? workflowState.startedAt,
        updatedAt: workflowState.updatedAt,
      };
    } catch {
      // If parsing fails, return a record with the raw outputs
      return {
        draftId,
        taskId: workflowState.taskId,
        builderJson: workflowState.outputsJson,
        createdAt: workflowState.startedAt,
        updatedAt: workflowState.updatedAt,
      };
    }
  }

  public listWorkflows(limit?: number): readonly WorkflowBuilderRecord[] {
    // For list operations, we would need to scan all workflow states with "draft" status
    // This is a limitation of using the runtime repository - list operations require
    // additional indexing. For now, return empty list; full implementation would
    // require a dedicated workflow_drafts table or secondary index.
    return [];
  }

  public deleteWorkflow(draftId: string): boolean {
    // RuntimeLifecycleRepository doesn't support delete, so we mark as deleted
    // by updating the status. This is a soft delete.
    const workflowState = this.runtimeRepository.getWorkflowState(draftId);
    if (workflowState == null) {
      return false;
    }
    this.runtimeRepository.updateWorkflowState(
      draftId,
      "deleted",
      workflowState.currentStepIndex,
      workflowState.outputsJson,
      nowIso(),
      workflowState.resumableFromStep,
    );
    return true;
  }
}

export interface WorkflowBuilderRequest {
  readonly session: WizardSession;
  readonly template: InteractionTemplate;
  readonly onboardingWizard: DomainOnboardingWizard;
  readonly components: readonly DraggableComponent[];
}

export interface WorkflowBuilderResult {
  readonly session: WizardSession;
  readonly template: InteractionTemplate;
  readonly builder: VisualWorkflowBuilder;
  readonly nextStepAllowed: boolean;
  readonly saveReview: WorkflowBuilderSaveReview;
}

export interface WorkflowBuilderSaveReview {
  readonly normalizedGraph: {
    readonly nodeIds: readonly string[];
    readonly edgePairs: readonly string[];
    readonly entryNodeIds: readonly string[];
    readonly terminalNodeIds: readonly string[];
    readonly planGraphBundle: PlanGraphBundle;
  };
  readonly validationMessages: readonly string[];
  readonly riskPropagation: {
    readonly highestRisk: "low" | "medium" | "high" | "critical";
    readonly riskyNodeIds: readonly string[];
    readonly findings: readonly GraphRiskFinding[];
  };
  readonly worstPathAnalysis: {
    readonly nodeIds: readonly string[];
    readonly score: number;
    readonly riskClass: RiskClass;
    readonly estimatedBudgetAmount: number;
    readonly timeoutMs: number;
  };
}

function categorizeComponents(components: readonly DraggableComponent[]): ComponentCategory[] {
  const groups = new Map<ComponentCategory["category"], DraggableComponent[]>();
  for (const component of components) {
    const category = component.componentId.includes("trigger")
      ? "trigger"
      : component.componentId.includes("condition")
        ? "condition"
        : component.componentId.includes("approval")
          ? "approval"
          : component.componentId.includes("output")
            ? "output"
            : "action";
    groups.set(category, [...(groups.get(category) ?? []), component]);
  }
  return [...groups.entries()].map(([category, items]) => ({
    category,
    components: items,
  }));
}

function getTemplateStepId(step: InteractionTemplate["steps"][number], index: number): string {
  return typeof step === "string" ? `node_${index + 1}` : step.stepId;
}

function getTemplateStepLabel(step: InteractionTemplate["steps"][number]): string {
  return typeof step === "string" ? step : step.stepId;
}

function buildPreview(template: InteractionTemplate, steps: readonly WizardStep[]): WorkflowPreview {
  return {
    estimatedDuration: `${Math.max(1, steps.length * 5)} min`,
    estimatedCost: `$${(template.steps.length * 0.03).toFixed(2)}`,
    riskAssessment: steps.some((item) => item.completed === false) ? "needs review" : "ready",
    stepByStepDescription: template.steps.map((step) => getTemplateStepLabel(step)),
  };
}

type BuilderCanvasNode = VisualWorkflowBuilder["canvas"]["nodes"][number];
type BuilderCanvasEdge = VisualWorkflowBuilder["canvas"]["edges"][number];
type BuilderComponentProfile = DraggableComponent & { readonly category: ComponentCategory["category"] };

function riskRank(riskClass: RiskClass): number {
  switch (riskClass) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "critical":
      return 3;
  }
}

function maxRisk(left: RiskClass, right: RiskClass): RiskClass {
  return riskRank(left) >= riskRank(right) ? left : right;
}

function categorizeComponent(component: DraggableComponent): ComponentCategory["category"] {
  if (component.componentId.includes("trigger")) {
    return "trigger";
  }
  if (component.componentId.includes("condition")) {
    return "condition";
  }
  if (component.componentId.includes("approval")) {
    return "approval";
  }
  if (component.componentId.includes("output")) {
    return "output";
  }
  return "action";
}

function determineNodeType(component: BuilderComponentProfile | null): PlanNodeType {
  switch (component?.category) {
    case "condition":
      return "router";
    case "approval":
      return "hitl_wait";
    default:
      return "tool";
  }
}

function resolveComponentProfile(component: BuilderComponentProfile | null, index: number): Pick<PlanNode, "riskClass" | "sideEffectProfile" | "budgetIntent" | "retryPolicyRef" | "timeoutMs"> {
  const riskClass = component?.riskLevel ?? "medium";
  const sideEffectProfile = component?.sideEffectProfile ?? {
    mayCommitExternalEffect: component?.category === "action" || component?.category === "output",
    reversible: riskClass !== "critical",
  };
  const retryPolicyRef = component?.compensationModel?.strategy === "none"
    ? "retry.none"
    : component?.compensationModel?.strategy === "manual_rollback"
      ? "retry.manual_review"
      : component?.compensationModel?.strategy === "automatic_rollback"
        ? "retry.auto_compensate"
        : component?.compensationModel?.strategy === "idempotent_replay"
          ? "retry.idempotent"
          : "retry.default";
  const budgetBase = sideEffectProfile.mayCommitExternalEffect ? 120 : 40;
  const budgetAmount = budgetBase + (riskRank(riskClass) * 40) + (index * 5);

  return {
    riskClass,
    sideEffectProfile,
    budgetIntent: {
      amount: budgetAmount,
      currency: "usd",
      resourceKinds: ["token"],
    },
    retryPolicyRef,
    timeoutMs: riskClass === "critical" ? 180_000 : riskClass === "high" ? 120_000 : 60_000,
  };
}

function buildPlanGraphNodes(
  nodes: readonly BuilderCanvasNode[],
  edges: readonly BuilderCanvasEdge[],
  componentIndex: ReadonlyMap<string, BuilderComponentProfile>,
): readonly PlanNode[] {
  const incomingByNode = new Map<string, string[]>();
  for (const edge of edges) {
    incomingByNode.set(edge.toNodeId, [...(incomingByNode.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }

  return nodes.map((node, index) => {
    const component = componentIndex.get(node.componentId) ?? null;
    const profile = resolveComponentProfile(component, index);
    return {
      nodeId: node.nodeId,
      nodeType: determineNodeType(component),
      inputRefs: incomingByNode.get(node.nodeId) ?? [],
      outputSchemaRef: `${node.componentId}.output`,
      riskClass: profile.riskClass,
      budgetIntent: profile.budgetIntent,
      sideEffectProfile: profile.sideEffectProfile,
      retryPolicyRef: profile.retryPolicyRef,
      timeoutMs: profile.timeoutMs,
    };
  });
}

function buildPlanGraphEdges(edges: readonly BuilderCanvasEdge[]): readonly PlanEdge[] {
  return [...new Set(edges.map((edge) => `${edge.fromNodeId}->${edge.toNodeId}`))]
    .map((pair, index) => {
      const [fromNodeId, toNodeId] = pair.split("->");
      return {
        edgeId: `edge_${index + 1}`,
        fromNodeId: fromNodeId!,
        toNodeId: toNodeId!,
        condition: true,
        dependencyType: "hard" as const,
      };
    });
}

function buildRiskPropagation(planNodes: readonly PlanNode[]): WorkflowBuilderSaveReview["riskPropagation"] {
  const findings = planNodes
    .filter((node) => node.sideEffectProfile.mayCommitExternalEffect || node.riskClass === "high" || node.riskClass === "critical")
    .map((node) => ({
      nodeId: node.nodeId,
      inheritedRiskClass: node.sideEffectProfile.mayCommitExternalEffect ? maxRisk(node.riskClass, "high") : node.riskClass,
      reasons: [
        node.sideEffectProfile.mayCommitExternalEffect ? "side_effect_external_commit" : "intrinsic_risk",
        node.sideEffectProfile.reversible ? "reversible" : "non_reversible",
      ],
    } satisfies GraphRiskFinding));
  const highestRisk = findings.reduce<RiskClass>(
    (current, finding) => maxRisk(current, finding.inheritedRiskClass),
    "low",
  );
  return {
    highestRisk,
    riskyNodeIds: findings.map((finding) => finding.nodeId),
    findings,
  };
}

function analyzeWorstPath(
  planNodes: readonly PlanNode[],
  edges: readonly PlanEdge[],
): WorkflowBuilderSaveReview["worstPathAnalysis"] {
  if (planNodes.length === 0) {
    return {
      nodeIds: [],
      score: 0,
      riskClass: "low",
      estimatedBudgetAmount: 0,
      timeoutMs: 0,
    };
  }

  const adjacency = new Map<string, string[]>();
  const incomingCounts = new Map<string, number>();
  const nodeIndex = new Map(planNodes.map((node) => [node.nodeId, node] as const));
  for (const node of planNodes) {
    adjacency.set(node.nodeId, []);
    incomingCounts.set(node.nodeId, 0);
  }
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    incomingCounts.set(edge.toNodeId, (incomingCounts.get(edge.toNodeId) ?? 0) + 1);
  }

  const queue = planNodes.filter((node) => (incomingCounts.get(node.nodeId) ?? 0) === 0).map((node) => node.nodeId);
  const scores = new Map<string, number>();
  const parents = new Map<string, string | null>();
  const pathRisk = new Map<string, RiskClass>();
  const pathBudget = new Map<string, number>();
  const pathTimeout = new Map<string, number>();

  for (const node of planNodes) {
    scores.set(node.nodeId, Number.NEGATIVE_INFINITY);
    pathRisk.set(node.nodeId, "low");
    pathBudget.set(node.nodeId, 0);
    pathTimeout.set(node.nodeId, 0);
  }

  for (const nodeId of queue) {
    const node = nodeIndex.get(nodeId)!;
    scores.set(nodeId, 1 + (riskRank(node.riskClass) * 10) + (node.sideEffectProfile.mayCommitExternalEffect ? 5 : 0));
    parents.set(nodeId, null);
    pathRisk.set(nodeId, node.riskClass);
    pathBudget.set(nodeId, node.budgetIntent.amount);
    pathTimeout.set(nodeId, node.timeoutMs);
  }

  for (let pointer = 0; pointer < queue.length; pointer += 1) {
    const nodeId = queue[pointer]!;
    const currentNode = nodeIndex.get(nodeId)!;
    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      const nextNode = nodeIndex.get(nextNodeId)!;
      const candidateScore = (scores.get(nodeId) ?? 0) + 1 + (riskRank(nextNode.riskClass) * 10) + (nextNode.sideEffectProfile.mayCommitExternalEffect ? 5 : 0);
      if (candidateScore > (scores.get(nextNodeId) ?? Number.NEGATIVE_INFINITY)) {
        scores.set(nextNodeId, candidateScore);
        parents.set(nextNodeId, nodeId);
        pathRisk.set(nextNodeId, maxRisk(pathRisk.get(nodeId) ?? currentNode.riskClass, nextNode.riskClass));
        pathBudget.set(nextNodeId, (pathBudget.get(nodeId) ?? 0) + nextNode.budgetIntent.amount);
        pathTimeout.set(nextNodeId, (pathTimeout.get(nodeId) ?? 0) + nextNode.timeoutMs);
      }
      incomingCounts.set(nextNodeId, (incomingCounts.get(nextNodeId) ?? 1) - 1);
      if ((incomingCounts.get(nextNodeId) ?? 0) === 0) {
        queue.push(nextNodeId);
      }
    }
  }

  const terminalNode = [...scores.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? planNodes[0]!.nodeId;
  const nodeIds: string[] = [];
  let currentNodeId: string | null = terminalNode;
  while (currentNodeId != null) {
    nodeIds.unshift(currentNodeId);
    currentNodeId = parents.get(currentNodeId) ?? null;
  }

  return {
    nodeIds,
    score: Math.max(scores.get(terminalNode) ?? planNodes.length, planNodes.length),
    riskClass: pathRisk.get(terminalNode) ?? "low",
    estimatedBudgetAmount: pathBudget.get(terminalNode) ?? 0,
    timeoutMs: pathTimeout.get(terminalNode) ?? 0,
  };
}

function normalizeGraph(
  nodes: readonly BuilderCanvasNode[],
  edges: readonly BuilderCanvasEdge[],
  components: readonly DraggableComponent[],
  harnessRunId: string,
  validationMessages: readonly string[],
): WorkflowBuilderSaveReview["normalizedGraph"] {
  const componentIndex = new Map<string, BuilderComponentProfile>();
  for (const component of components) {
    componentIndex.set(component.componentId, {
      ...component,
      category: categorizeComponent(component),
    });
  }
  const nodeIds = [...new Set(nodes.map((node) => node.nodeId))];
  const edgePairs = [...new Set(edges.map((edge) => `${edge.fromNodeId}->${edge.toNodeId}`))];
  const planNodes = buildPlanGraphNodes(nodes, edges, componentIndex);
  const planEdges = buildPlanGraphEdges(edges);
  const entryNodeIds = nodeIds.filter((nodeId) => !planEdges.some((edge) => edge.toNodeId === nodeId));
  const terminalNodeIds = nodeIds.filter((nodeId) => !planEdges.some((edge) => edge.fromNodeId === nodeId));
  const riskPropagation = buildRiskPropagation(planNodes);
  const worstPath = analyzeWorstPath(planNodes, planEdges);
  const graphHash = createHash("sha256")
    .update(JSON.stringify({ nodeIds, edgePairs, risk: riskPropagation.highestRisk }))
    .digest("hex");

  const planGraphBundle = createPlanGraphBundle({
    harnessRunId,
    graph: {
      graphId: `${harnessRunId}:graph`,
      nodes: planNodes,
      edges: planEdges,
      entryNodeIds,
      terminalNodeIds,
      joinStrategy: "all",
      graphHash,
    },
    schedulerPolicy: {
      policyId: "workflow_builder_fifo",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: `${harnessRunId}:budget`,
    riskProfile: {
      riskClass: riskPropagation.highestRisk,
      reasons: riskPropagation.findings.flatMap((finding) => finding.reasons),
    },
    validationReport: {
      valid: validationMessages.length === 0,
      findings: [...validationMessages],
      normalizedNodeIds: nodeIds,
      riskPropagation: riskPropagation.findings,
      worstPath: {
        pathNodeIds: worstPath.nodeIds,
        riskClass: worstPath.riskClass,
        estimatedBudgetAmount: worstPath.estimatedBudgetAmount,
        timeoutMs: worstPath.timeoutMs,
      } satisfies GraphWorstPathAnalysis,
    },
  });

  return {
    nodeIds,
    edgePairs,
    entryNodeIds,
    terminalNodeIds,
    planGraphBundle,
  };
}

function validateGraph(nodes: readonly { nodeId: string; label: string }[], edges: readonly { fromNodeId: string; toNodeId: string }[]): string[] {
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const messages: string[] = [];
  for (const edge of edges) {
    if (!nodeIds.has(edge.fromNodeId) || !nodeIds.has(edge.toNodeId)) {
      messages.push("workflow_builder.invalid_edge_reference");
    }
  }
  const visited = new Set<string>();
  const stack = new Set<string>();
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.nodeId, []);
  }
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  }
  const hasCycle = (nodeId: string): boolean => {
    if (stack.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of adjacency.get(nodeId) ?? []) {
      if (hasCycle(next)) {
        return true;
      }
    }
    stack.delete(nodeId);
    return false;
  };
  for (const node of nodes) {
    if (hasCycle(node.nodeId)) {
      messages.push("workflow_builder.cycle_detected");
      break;
    }
  }
  if (nodes.some((node) => node.label.trim().length === 0)) {
    messages.push("workflow_builder.empty_node_label");
  }
  return messages;
}

export class WorkflowBuilderService {
  private readonly repository: WorkflowBuilderRepository | null;

  public constructor(repository?: WorkflowBuilderRepository) {
    this.repository = repository ?? null;
  }

  public build(request: WorkflowBuilderRequest): WorkflowBuilderResult {
    const template = applyInteractionTemplate(request.template);
    const nextStepAllowed = canAdvanceWizard(request.session);
    const palette = categorizeComponents(request.components);
    const builder: VisualWorkflowBuilder = {
      canvas: {
        nodes: template.steps.map((step, index) => ({
          nodeId: getTemplateStepId(step, index),
          componentId: palette.flatMap((item) => item.components).find((component) =>
            component.previewDescription.toLowerCase().includes(getTemplateStepLabel(step).toLowerCase())
              || component.name.toLowerCase().includes(getTemplateStepLabel(step).toLowerCase()),
          )?.componentId ?? `template_step_${index + 1}`,
          label: getTemplateStepLabel(step),
        })),
        edges: template.steps.slice(1).map((_, index) => ({
          fromNodeId: getTemplateStepId(template.steps[index]!, index),
          toNodeId: getTemplateStepId(template.steps[index + 1]!, index + 1),
        })),
      },
      componentPalette: palette,
      livePreview: buildPreview(template, request.session.steps),
      validation: {
        valid: nextStepAllowed || request.session.steps.every((step) => step.completed),
        messages: nextStepAllowed
          ? []
          : [`complete current step before leaving ${request.session.currentStepId}`],
      },
      progressiveDisclosure: {
        level: "minimal" as const,
        hiddenCategories: [],
        defaultExpandedCategories: [],
      },
    };
    const validationMessages = validateGraph(builder.canvas.nodes, builder.canvas.edges);
    const normalizedGraph = normalizeGraph(
      builder.canvas.nodes,
      builder.canvas.edges,
      request.components,
      request.session.sessionId,
      validationMessages,
    );
    const worstPathAnalysis = analyzeWorstPath(
      normalizedGraph.planGraphBundle.graph.nodes,
      normalizedGraph.planGraphBundle.graph.edges,
    );
    const riskPropagation = buildRiskPropagation(normalizedGraph.planGraphBundle.graph.nodes);
    const saveReview: WorkflowBuilderSaveReview = {
      normalizedGraph,
      validationMessages,
      riskPropagation,
      worstPathAnalysis,
    };

    return {
      session: request.session,
      template,
      builder,
      nextStepAllowed,
      saveReview,
    };
  }

  /**
   * Save a workflow builder definition to durable storage.
   * Requires a repository to be configured.
   */
  public saveWorkflow(input: {
    readonly draftId?: string;
    readonly taskId?: string;
    readonly builder: VisualWorkflowBuilder;
    readonly ownerUserId?: string;
  }): WorkflowBuilderRecord | null {
    if (this.repository == null) {
      return null;
    }
    const draftId = input.draftId ?? newId("wfb_draft");
    const taskId = input.taskId ?? newId("wfb_task");
    const now = nowIso();
    const record: WorkflowBuilderRecord = {
      draftId,
      taskId,
      builderJson: JSON.stringify(input.builder),
      createdAt: now,
      updatedAt: now,
    };
    this.repository.saveWorkflow(record);
    return record;
  }

  /**
   * Load a workflow builder definition from durable storage.
   * Returns null if no repository is configured or the draft is not found.
   */
  public loadWorkflow(draftId: string): VisualWorkflowBuilder | null {
    if (this.repository == null) {
      return null;
    }
    const record = this.repository.loadWorkflow(draftId);
    if (record == null) {
      return null;
    }
    try {
      return JSON.parse(record.builderJson) as VisualWorkflowBuilder;
    } catch {
      return null;
    }
  }

  /**
   * List all workflow builder definitions from durable storage.
   * Returns empty array if no repository is configured.
   */
  public listWorkflows(limit?: number): readonly WorkflowBuilderRecord[] {
    if (this.repository == null) {
      return [];
    }
    return this.repository.listWorkflows(limit);
  }

  /**
   * Delete a workflow builder definition from durable storage.
   * Returns false if no repository is configured or the draft was not found.
   */
  public deleteWorkflow(draftId: string): boolean {
    if (this.repository == null) {
      return false;
    }
    return this.repository.deleteWorkflow(draftId);
  }
}
