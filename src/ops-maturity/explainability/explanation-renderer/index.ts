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

  // Build nodes for causal links
  for (const link of causalLinks) {
    const sourceNode: DecisionTreeNode = {
      nodeId: `source-${link.source}`,
      type: "factor",
      label: link.source,
      children: [],
    };
    const targetNode: DecisionTreeNode = {
      nodeId: `target-${link.target}`,
      type: "outcome",
      label: link.target,
      children: [],
    };
    if (!nodeMap.has(sourceNode.nodeId)) {
      nodeMap.set(sourceNode.nodeId, sourceNode);
    }
    if (!nodeMap.has(targetNode.nodeId)) {
      nodeMap.set(targetNode.nodeId, targetNode);
    }
  }

  // Add evidence nodes
  for (let i = 0; i < evidenceLabels.length; i++) {
    const evidenceNode: DecisionTreeNode = {
      nodeId: `evidence-${i}`,
      type: "evidence",
      label: evidenceLabels[i]!,
    };
    nodeMap.set(evidenceNode.nodeId, evidenceNode);
  }

  // Add decision factor nodes
  for (let i = 0; i < decisionFactors.length; i++) {
    const factorNode: DecisionTreeNode = {
      nodeId: `factor-${i}`,
      type: "factor",
      label: decisionFactors[i]!,
    };
    nodeMap.set(factorNode.nodeId, factorNode);
  }

  // Calculate max depth
  let maxDepth = 0;
  const calculateDepth = (nodeId: string, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    return depth;
  };
  calculateDepth("root", 0);

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
