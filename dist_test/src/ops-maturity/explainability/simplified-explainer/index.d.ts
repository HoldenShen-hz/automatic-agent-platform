/**
 * @fileoverview Simplified Explainer for Non-Technical Users
 *
 * Transforms complex technical explanations into simple, jargon-free language
 * that business stakeholders can understand.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §62 (可解释性增强)
 */
import type { CausalLink } from "../causal-chain-builder/index.js";
/**
 * Audience type for explanation tailoring.
 */
export type AudienceType = "executive" | "operator" | "auditor";
/**
 * Simplified explanation output.
 */
export interface SimplifiedExplanation {
    readonly headline: string;
    readonly whatHappened: string;
    readonly whyItMatters: string;
    readonly whatToDo: string;
    readonly riskLevel: "low" | "medium" | "high" | "critical";
    readonly confidencePercent: number;
}
/**
 * Simplifies a technical stage explanation for business audiences.
 */
export declare function simplifyExplanation(stageName: string, summary: string, decisionFactors: readonly string[], causalLinks: readonly CausalLink[], riskLevel?: string): SimplifiedExplanation;
/**
 * Formats simplified explanation as markdown for display.
 */
export declare function formatAsMarkdown(explanation: SimplifiedExplanation): string;
/**
 * Formats simplified explanation as plain text for notifications.
 */
export declare function formatAsNotification(explanation: SimplifiedExplanation): string;
