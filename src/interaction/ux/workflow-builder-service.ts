import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { applyInteractionTemplate, type InteractionTemplate } from "./template-engine/index.js";
import { canAdvanceWizard, type WizardSession, type WizardStep } from "./wizard/index.js";
import type {
  DomainOnboardingWizard,
  VisualWorkflowBuilder,
  DraggableComponent,
  ComponentCategory,
  WorkflowPreview,
} from "./onboarding/index.js";

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

// REST API request/response types for CRUD + validate + publish
export interface CreateWorkflowRequest {
  readonly name: string;
  readonly description?: string;
  readonly nodes: readonly { nodeId: string; label: string; componentId?: string }[];
  readonly edges: readonly { fromNodeId: string; toNodeId: string }[];
  readonly divisionId?: string;
  readonly tenantId?: string;
}

export interface UpdateWorkflowRequest {
  readonly workflowId: string;
  readonly name?: string;
  readonly description?: string;
  readonly nodes?: readonly { nodeId: string; label: string; componentId?: string }[];
  readonly edges?: readonly { fromNodeId: string; toNodeId: string }[];
}

export interface ValidateWorkflowRequest {
  readonly nodes: readonly { nodeId: string; label: string }[];
  readonly edges: readonly { fromNodeId: string; toNodeId: string }[];
}

export interface PublishWorkflowRequest {
  readonly workflowId: string;
  readonly version?: string;
}

export interface WorkflowResponse {
  readonly workflowId: string;
  readonly name: string;
  readonly description: string;
  readonly status: "draft" | "published" | "archived";
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
}

export interface ValidationResponse {
  readonly valid: boolean;
  readonly messages: readonly string[];
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
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

function buildPreview(template: InteractionTemplate, steps: readonly WizardStep[]): WorkflowPreview {
  return {
    estimatedDuration: `${Math.max(1, steps.length * 5)} min`,
    estimatedCost: `$${(template.steps.length * 0.03).toFixed(2)}`,
    riskAssessment: steps.some((item) => item.completed === false) ? "needs review" : "ready",
    stepByStepDescription: template.steps,
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
  public build(request: WorkflowBuilderRequest): WorkflowBuilderResult {
    const template = applyInteractionTemplate(request.template);
    const nextStepAllowed = canAdvanceWizard(request.session);
    const palette = categorizeComponents(request.components);
    const builder: VisualWorkflowBuilder = {
      canvas: {
        nodes: template.steps.map((step, index) => ({
          nodeId: `node_${index + 1}`,
          componentId: palette.flatMap((item) => item.components).find((component) =>
            component.previewDescription.toLowerCase().includes(step.toLowerCase())
              || component.name.toLowerCase().includes(step.toLowerCase()),
          )?.componentId ?? `template_step_${index + 1}`,
          label: step,
        })),
        edges: template.steps.slice(1).map((_, index) => ({
          fromNodeId: `node_${index + 1}`,
          toNodeId: `node_${index + 2}`,
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
}
