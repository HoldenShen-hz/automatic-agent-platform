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
export declare function renderStageExplanation(stage: string, summary: string, evidenceIds: readonly string[]): string;
/**
 * Builds a decision tree from causal links and evidence.
 * Provides structured format for programmatic inspection and visualization.
 */
export declare function buildDecisionTree(rootLabel: string, causalLinks: readonly CausalLink[], evidenceLabels: readonly string[], decisionFactors: readonly string[]): StructuredExplanation;
/**
 * Renders explanation in structured JSON format.
 */
export declare function renderStructuredExplanation(stage: string, summary: string, causalLinks: readonly CausalLink[], evidenceLabels: readonly string[], decisionFactors: readonly string[]): string;
/**
 * Renders explanation in plain text (legacy format).
 */
export declare function renderPlainTextExplanation(stage: string, summary: string, causalLinks: readonly CausalLink[], evidenceLabels: readonly string[], decisionFactors: readonly string[]): string;
/**
 * Determines appropriate rendering format based on audience.
 */
export declare function renderForAudience(stage: string, summary: string, causalLinks: readonly CausalLink[], evidenceLabels: readonly string[], decisionFactors: readonly string[], audience: "technical" | "business" | "audit"): string;
