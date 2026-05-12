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
  // Build node definitions with children arrays pre-wired
  type NodeDef = { node: DecisionTreeNode; children: DecisionTreeNode[] };

  const nodeDefs = new Map<string, NodeDef>();
  const childNodeIds = new Set<string>();
  const sourceNodeIds: string[] = [];

  // Root node
  const rootChildren: DecisionTreeNode[] = [];
  const rootDef: NodeDef = {
    node: {
      nodeId: "root",
      type: "decision",
      label: rootLabel,
      children: rootChildren,
    },
    children: rootChildren,
  };
  nodeDefs.set("root", rootDef);

  // Causal link nodes - first pass: create all nodes
  for (const link of causalLinks) {
    const sourceId = `causal-${link.source}`;
    const targetId = `causal-${link.target}`;

    if (!nodeDefs.has(sourceId)) {
      nodeDefs.set(sourceId, { node: { nodeId: sourceId, type: "factor", label: link.source, children: [] }, children: [] });
    }
    if (!nodeDefs.has(targetId)) {
      nodeDefs.set(targetId, { node: { nodeId: targetId, type: "outcome", label: link.target, children: [] }, children: [] });
    }
    if (!sourceNodeIds.includes(sourceId)) {
      sourceNodeIds.push(sourceId);
    }
    childNodeIds.add(targetId);
  }

  // Second pass: wire up causal link parent-child relationships
  for (const link of causalLinks) {
    const sourceId = `causal-${link.source}`;
    const targetId = `causal-${link.target}`;
    nodeDefs.get(sourceId)!.children.push(nodeDefs.get(targetId)!.node);
  }

  // Add evidence nodes as children of root
  for (let i = 0; i < evidenceLabels.length; i++) {
    const evidenceDef: NodeDef = {
      node: {
        nodeId: `evidence-${i}`,
        type: "evidence",
        label: evidenceLabels[i] as string,
        children: [],
      },
      children: [],
    };
    nodeDefs.set(evidenceDef.node.nodeId, evidenceDef);
    rootChildren.push(evidenceDef.node);
  }

  // Add decision factor nodes as children of root
  for (let i = 0; i < decisionFactors.length; i++) {
    const factorDef: NodeDef = {
      node: {
        nodeId: `factor-${i}`,
        type: "factor",
        label: decisionFactors[i] as string,
        children: [],
      },
      children: [],
    };
    nodeDefs.set(factorDef.node.nodeId, factorDef);
    rootChildren.push(factorDef.node);
  }

  // Add causal chain source nodes as children of root so they are traversed in maxDepth calculation
  for (const sourceId of sourceNodeIds) {
    if (childNodeIds.has(sourceId)) {
      continue;
    }
    const sourceDef = nodeDefs.get(sourceId);
    if (sourceDef) {
      rootChildren.push(sourceDef.node);
    }
  }

  // Calculate max depth by traversing the tree recursively
  const calculateDepth = (nodeId: string, depth: number): number => {
    const def = nodeDefs.get(nodeId);
    if (!def || def.children.length === 0) {
      return depth;
    }
    let maxChildDepth = depth;
    for (const child of def.children) {
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
    rootNode: rootDef.node,
    allNodes: [...nodeDefs.values()].map((d) => d.node),
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
