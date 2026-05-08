import { newId, nowIso } from "../../platform/contracts/types/ids.js";
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
  };
  readonly validationMessages: readonly string[];
  readonly riskPropagation: {
    readonly highestRisk: "low" | "medium" | "high" | "critical";
    readonly riskyNodeIds: readonly string[];
  };
  readonly worstPathAnalysis: {
    readonly nodeIds: readonly string[];
    readonly score: number;
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

function normalizeGraph(nodes: readonly { nodeId: string; label: string }[], edges: readonly { fromNodeId: string; toNodeId: string }[]): WorkflowBuilderSaveReview["normalizedGraph"] {
  return {
    nodeIds: [...new Set(nodes.map((node) => node.nodeId))],
    edgePairs: [...new Set(edges.map((edge) => `${edge.fromNodeId}->${edge.toNodeId}`))],
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

function propagateRisk(nodes: readonly { nodeId: string; label: string }[]): WorkflowBuilderSaveReview["riskPropagation"] {
  const riskyNodeIds = nodes
    .filter((node) => /(approve|deploy|publish|delete|approval|发布|删除)/i.test(node.label))
    .map((node) => node.nodeId);
  return {
    highestRisk: riskyNodeIds.length === 0
      ? "low"
      : riskyNodeIds.length >= 3
        ? "critical"
        : riskyNodeIds.length >= 2
          ? "high"
          : "medium",
    riskyNodeIds,
  };
}

function analyzeWorstPath(nodes: readonly { nodeId: string }[], edges: readonly { fromNodeId: string; toNodeId: string }[]): WorkflowBuilderSaveReview["worstPathAnalysis"] {
  if (nodes.length === 0) {
    return {
      nodeIds: [],
      score: 0,
    };
  }
  return {
    nodeIds: [nodes[0]!.nodeId, ...(edges.map((edge) => edge.toNodeId))].slice(0, Math.max(1, nodes.length)),
    score: edges.length + nodes.length,
  };
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
    const saveReview: WorkflowBuilderSaveReview = {
      normalizedGraph: normalizeGraph(builder.canvas.nodes, builder.canvas.edges),
      validationMessages: validateGraph(builder.canvas.nodes, builder.canvas.edges),
      riskPropagation: propagateRisk(builder.canvas.nodes),
      worstPathAnalysis: analyzeWorstPath(builder.canvas.nodes, builder.canvas.edges),
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
