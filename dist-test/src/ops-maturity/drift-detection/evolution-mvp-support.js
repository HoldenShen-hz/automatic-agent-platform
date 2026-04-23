/**
 * Evolution MVP Service
 *
 * Manages the lifecycle of evolution proposals including budget adjustments and experience promotion.
 * Proposals go through a workflow: create -> pending approval -> approved -> applied -> rolled back.
 * Budget adjustments modify cost policies based on observed spending patterns.
 * Experience promotion elevates successful task patterns into reusable structured memory.
 */
import { ValidationError } from "../../platform/contracts/errors.js";
/** Pattern for validating scope reference format */
const SCOPE_REF_PATTERN = /^[a-zA-Z0-9._:-]{2,128}$/;
/**
 * Validates that a scope reference conforms to the expected format.
 */
export function assertEvolutionScope(scopeType, scopeRef) {
    if (!SCOPE_REF_PATTERN.test(scopeRef)) {
        throw new ValidationError(`evolution.invalid_scope_ref:${scopeType}`, `evolution.invalid_scope_ref:${scopeType}`, {
            retryable: false,
            details: { scopeType, scopeRef },
        });
    }
}
/**
 * Rounds a currency value to 4 decimal places to avoid floating point issues.
 */
export function roundCurrency(value) {
    return Math.round(value * 10000) / 10000;
}
/**
 * Rounds a ratio value to 3 decimal places.
 */
export function roundRatio(value) {
    return Math.round(value * 1000) / 1000;
}
/**
 * Clamps a value between minimum and maximum bounds.
 */
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
/**
 * Generates a human-readable summary for a budget adjustment proposal.
 */
export function summarizeBudgetProposal(scopeType, scopeRef, evidence) {
    return [
        `Apply conservative budget adjustment for ${scopeType}:${scopeRef}.`,
        `Observed avg spend ${evidence.observedAverageCostUsd.toFixed(4)} USD across ${evidence.sampleSize} samples.`,
        `Target maxTaskCostUsd ${evidence.currentPolicy.maxTaskCostUsd.toFixed(4)} -> ${evidence.recommendedPolicy.maxTaskCostUsd.toFixed(4)}.`,
    ].join(" ");
}
/**
 * Computes a recommended budget policy based on observed spending patterns.
 * Increases limits when spending is near limits with good success rate.
 * Decreases limits when spending is well below limits consistently.
 */
export function buildRecommendedBudgetPolicy(input) {
    if (input.sampleSize < 3) {
        throw new ValidationError("evolution.insufficient_budget_samples", "evolution.insufficient_budget_samples", {
            retryable: false,
            details: { sampleSize: input.sampleSize },
        });
    }
    if (!(input.successRate >= 0 && input.successRate <= 1)) {
        throw new ValidationError("evolution.invalid_success_rate", "evolution.invalid_success_rate", {
            retryable: false,
            details: { successRate: input.successRate },
        });
    }
    if (input.observedAverageCostUsd <= 0) {
        throw new ValidationError("evolution.invalid_observed_cost", "evolution.invalid_observed_cost", {
            retryable: false,
            details: { observedAverageCostUsd: input.observedAverageCostUsd },
        });
    }
    const baseline = input.currentPolicy;
    const observed = input.observedAverageCostUsd;
    const increaseTarget = observed * 1.15;
    const decreaseTarget = observed * 1.2;
    let nextMaxTaskCostUsd = baseline.maxTaskCostUsd;
    if (observed > baseline.maxTaskCostUsd * 0.85 && input.successRate >= 0.6) {
        nextMaxTaskCostUsd = Math.min(baseline.maxTaskCostUsd * 1.25, increaseTarget);
    }
    else if (observed < baseline.maxTaskCostUsd * 0.45 && input.sampleSize >= 5) {
        nextMaxTaskCostUsd = Math.max(baseline.maxTaskCostUsd * 0.8, decreaseTarget);
    }
    return {
        ...baseline,
        maxTaskCostUsd: roundCurrency(clamp(nextMaxTaskCostUsd, baseline.maxTaskCostUsd * 0.8, baseline.maxTaskCostUsd * 1.25)),
        warnAtRatio: roundRatio(clamp(baseline.warnAtRatio, 0.65, 0.95)),
    };
}
/**
 * Parses the JSON payload from an evolution proposal record.
 */
export function parseProposalPayload(record) {
    return JSON.parse(record.proposalJson);
}
/**
 * Parses the JSON value from an evolution policy record.
 */
export function parsePolicyValue(record) {
    return JSON.parse(record.valueJson);
}
/**
 * Service managing the lifecycle of evolution proposals.
 *
 * Evolution proposals allow the system to adapt its behavior over time:
 * - Budget adjustments modify cost policies based on observed spending
 * - Experience promotion captures successful task patterns for reuse
 *
 * Proposals require approval before being applied and can be rolled back.
 */
//# sourceMappingURL=evolution-mvp-support.js.map