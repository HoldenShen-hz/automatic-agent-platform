import type { ExplanationDepth } from "../explanation-pipeline-service.js";
import type { CausalLink } from "../causal-chain-builder/index.js";

/**
 * Decision tree node for structured explanation format.
 * Enables programmatic inspection and visualization of the reasoning chain.
 */
export interface DecisionTreeNode {
  readonly nodeId: string;
  readonly type: "decision" | "factor" | "evidence" | "outcome";
  readonly label: string;
  readonly confidence?: number;
  readonly children?: readonly DecisionTreeNode[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Structured explanation format - machine-readable decision tree.
 */
export interface StructuredExplanation {
  readonly format: "decision_tree";
  readonly version: "1.0";
  readonly rootNode: DecisionTreeNode;
  readonly allNodes: readonly DecisionTreeNode[];
  readonly maxDepth: number;
}

/**
 * Legacy plain text explanation (backward compatible).
 */
export function renderStageExplanation(stage: string, summary: string, evidenceIds: readonly string[]): string {
  return `${stage}: ${summary}${evidenceIds.length > 0 ? ` [evidence=${evidenceIds.join(",")}]` : ""}`;
}

/**
 * Builds a decision tree from causal links and evidence.
 * Provides structured format for programmatic inspection and visualization.
 */
export function buildDecisionTree(
  rootLabel: string,
  causalLinks: readonly CausalLink[],
  evidenceLabels: readonly string[],
  decisionFactors: readonly string[],
): StructuredExplanation {
  const nodeMap = new Map<string, DecisionTreeNode>();
  const rootNode: DecisionTreeNode = {
    nodeId: "root",
    type: "decision",
    label: rootLabel,
    children: [],
  };
  nodeMap.set("root", rootNode);

  // Build nodes for causal links and wire up parent-child relationships
  // so the tree structure reflects actual causal dependencies
  for (const link of causalLinks) {
    const sourceId = `source-${link.source}`;
    const targetId = `target-${link.target}`;

    let sourceNode = nodeMap.get(sourceId);
    let targetNode = nodeMap.get(targetId);

    if (!sourceNode) {
      sourceNode = {
        nodeId: sourceId,
        type: "factor",
        label: link.source,
        children: [],
      };
      nodeMap.set(sourceId, sourceNode);
    }

    if (!targetNode) {
      targetNode = {
        nodeId: targetId,
        type: "outcome",
        label: link.target,
        children: [],
      };
      nodeMap.set(targetId, targetNode);
    }

    // Wire up parent-child relationship so depth calculation works
    if (!sourceNode.children) sourceNode.children = [];
    if (!sourceNode.children.some((c) => c.nodeId === targetId)) {
      sourceNode.children.push(targetNode);
    }
  }

  // Add evidence nodes
  for (let i = 0; i < evidenceLabels.length; i++) {
    const evidenceNode: DecisionTreeNode = {
      nodeId: `evidence-${i}`,
      type: "evidence",
      label: evidenceLabels[i] as string,
      children: [],
    };
    nodeMap.set(evidenceNode.nodeId, evidenceNode);
    // Evidence nodes are children of the root
    rootNode.children!.push(evidenceNode);
  }

  // Add decision factor nodes
  for (let i = 0; i < decisionFactors.length; i++) {
    const factorNode: DecisionTreeNode = {
      nodeId: `factor-${i}`,
      type: "factor",
      label: decisionFactors[i] as string,
      children: [],
    };
    nodeMap.set(factorNode.nodeId, factorNode);
    // Factor nodes are children of the root
    rootNode.children!.push(factorNode);
  }

  // Calculate max depth by traversing the tree recursively
  const calculateDepth = (nodeId: string, depth: number): number => {
    const node = nodeMap.get(nodeId);
    if (!node || !node.children || node.children.length === 0) {
      return depth;
    }
    let maxChildDepth = depth;
    for (const child of node.children) {
      const childDepth = calculateDepth(child.nodeId, depth + 1);
      if (childDepth > maxChildDepth) {
        maxChildDepth = childDepth;
      }
    }
    return maxChildDepth;
  };

  const maxDepth = calculateDepth("root", 0);

  return {
    format: "decision_tree",
    version: "1.0",
    rootNode: rootNode,
    allNodes: [...nodeMap.values()],
    maxDepth,
  };
}

/**
 * Renders explanation in structured JSON format.
 */
export function renderStructuredExplanation(
  stage: string,
  summary: string,
  causalLinks: readonly CausalLink[],
  evidenceLabels: readonly string[],
  decisionFactors: readonly string[],
): string {
  const tree = buildDecisionTree(summary, causalLinks, evidenceLabels, decisionFactors);
  return JSON.stringify(tree, null, 2);
}

/**
 * Renders explanation in plain text (legacy format).
 */
export function renderPlainTextExplanation(
  stage: string,
  summary: string,
  causalLinks: readonly CausalLink[],
  evidenceLabels: readonly string[],
  decisionFactors: readonly string[],
): string {
  const lines: string[] = [`[${stage}] ${summary}`];

  if (decisionFactors.length > 0) {
    lines.push("Factors:");
    for (const factor of decisionFactors) {
      lines.push(`  • ${factor}`);
    }
  }

  if (evidenceLabels.length > 0) {
    lines.push("Evidence:");
    for (const evidence of evidenceLabels) {
      lines.push(`  • ${evidence}`);
    }
  }

  if (causalLinks.length > 0) {
    lines.push("Reasoning Chain:");
    for (const link of causalLinks) {
      lines.push(`  ${link.source} → ${link.target} (${link.rationale})`);
    }
  }

  return lines.join("\n");
}

/**
 * Determines appropriate rendering format based on audience.
 */
export function renderForAudience(
  stage: string,
  summary: string,
  causalLinks: readonly CausalLink[],
  evidenceLabels: readonly string[],
  decisionFactors: readonly string[],
  audience: "technical" | "business" | "audit",
): string {
  switch (audience) {
    case "audit":
    case "technical":
      return renderStructuredExplanation(stage, summary, causalLinks, evidenceLabels, decisionFactors);
    case "business":
      return renderPlainTextExplanation(stage, summary, causalLinks, evidenceLabels, decisionFactors);
    default:
      return renderPlainTextExplanation(stage, summary, causalLinks, evidenceLabels, decisionFactors);
  }
}