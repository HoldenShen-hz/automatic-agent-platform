/**
 * KV Cache Prefix Configuration — GAP-V2-G9
 *
 * Design: §E.2 KV Cache Fixed Prefix / ADR-003
 *
 * System prompt is partitioned into three layers to enable KV cache reuse:
 * - fixed_prefix: Stable system instructions (governance, constraints, permanent directives)
 *   → Budget: 800-1200 tokens, cached across agents by hash
 * - domain_block: Domain-specific instructions (per-division rules)
 *   → Budget: 300-500 tokens per domain, cached within domain
 * - variable_suffix: Per-agent task context (current plan, memory summaries, execution state)
 *   → Budget: remaining context, NOT cached (changes per request)
 *
 * Budget enforcement:
 * - fixed_prefix and domain_block budgets are reserved first
 * - variable_suffix gets whatever remains
 * - Compaction respects layer boundaries (fixed_prefix never compacted)
 */
const DEFAULT_BUDGET = {
    fixedPrefixMaxTokens: 1000,
    domainBlockMaxTokens: 400,
    enforceBudget: true,
};
const DEFAULT_STRATEGY = {
    cacheKeyStrategy: "hash_prefix",
    kvCacheEnabled: true,
    fixedPrefixShareable: true,
    domainBlockShareable: true,
};
/**
 * Default fixed prefix template — governance constraints and stable directives.
 * This should be consistent across all agents in the system.
 */
const DEFAULT_FIXED_PREFIX_TEMPLATE = `# System Configuration

## Governance
- All operations must comply with security policies
- Tool execution requires authorization context
- Cost tracking is mandatory for all billable operations

## Constraints
- Never expose credentials or secrets in outputs
- Validate all external inputs before processing
- Maintain audit trail for state-changing operations

## Directives
- Prefer deterministic operations over non-deterministic ones
- Minimize token usage while maintaining correctness
- Preserve context for handoff between agents
`;
/**
 * Creates a KV Cache prefix configuration with defaults.
 */
export function createKvCachePrefixConfig(overrides = {}) {
    return {
        budget: { ...DEFAULT_BUDGET, ...overrides.budget },
        strategy: { ...DEFAULT_STRATEGY, ...overrides.strategy },
        fixedPrefixTemplate: overrides.fixedPrefixTemplate ?? DEFAULT_FIXED_PREFIX_TEMPLATE,
        domainBlockTemplates: overrides.domainBlockTemplates ?? {},
    };
}
/**
 * Estimates token count for a given text (rough: 4 chars ≈ 1 token).
 */
export function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}
/**
 * Checks if a given text fits within the fixed_prefix budget.
 */
export function isWithinFixedPrefixBudget(text, config) {
    if (!config.strategy.kvCacheEnabled) {
        return true;
    }
    if (!config.budget.enforceBudget) {
        return true;
    }
    return estimateTokens(text) <= (config.budget.fixedPrefixMaxTokens ?? 1000);
}
/**
 * Checks if a given text fits within the domain_block budget for a specific domain.
 */
export function isWithinDomainBlockBudget(text, domainId, config) {
    if (!config.strategy.kvCacheEnabled) {
        return true;
    }
    if (!config.budget.enforceBudget) {
        return true;
    }
    return estimateTokens(text) <= (config.budget.domainBlockMaxTokens ?? 400);
}
//# sourceMappingURL=kv-cache-prefix-config.js.map