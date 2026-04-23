/**
 * Approval Policy Rule Engine
 *
 * Evaluates declarative approval policy rules against policy decision context.
 * Rules are matched in priority order, with the first matching rule determining
 * the outcome.
 *
 * ## Evaluation Order
 *
 * 1. Filter to enabled rules only
 * 2. Sort by priority (highest first)
 * 3. Evaluate conditions for each rule
 * 4. First matching rule wins
 * 5. If no rule matches, use default (no approval required)
 */
import type { ApprovalPolicyBundle, ApprovalPolicyContext, ApprovalPolicyResult, PolicyLintResult } from "./types.js";
/**
 * Evaluates approval policies against a policy decision context.
 */
export declare class ApprovalPolicyEngine {
    private readonly bundle;
    constructor(bundle: ApprovalPolicyBundle);
    /**
     * Evaluates the policy bundle against the given context.
     *
     * @param context - The policy decision context to evaluate
     * @returns The approval policy result
     */
    evaluate(context: ApprovalPolicyContext): ApprovalPolicyResult;
    /**
     * Checks if a rule's conditions match the context.
     */
    private matchesConditions;
    /**
     * Evaluates a single condition against the context.
     */
    private evaluateCondition;
    /**
     * Gets a field value from the context by path (e.g., "riskCategory", "metadata.costCenter").
     */
    private getFieldValue;
    /**
     * Compares values using the specified operator.
     */
    private compareValues;
    /**
     * Applies a matching rule and returns the result.
     */
    private applyRule;
    /**
     * Returns the default result when no rule matches.
     */
    private defaultResult;
    /**
     * Lints the policy bundle for issues.
     *
     * Checks for:
     * - Unreachable rules (deny/ask rules that can never match)
     * - Shadowed rules (rules that are always overridden by higher priority)
     * - Invalid field references
     * - Duplicate rule IDs
     */
    lint(): PolicyLintResult;
    /**
     * Checks if a higher priority rule always overrides a lower priority rule.
     */
    private ruleAlwaysOverrides;
}
/**
 * Creates a policy engine with the default approval policies.
 */
export declare function createDefaultPolicyEngine(): ApprovalPolicyEngine;
