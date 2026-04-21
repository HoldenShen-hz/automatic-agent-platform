/**
 * Cache Orchestration Types
 *
 * Defines the core types for the multi-level cache system including L1/L2/L3
 * cache scopes, metadata structures, policies, and lookup results.
 */
export const CACHEABLE_TOOLS = [
    'read',
    'glob',
    'grep',
    'repo_map',
    'diagnostics',
    'web_fetch',
    'memory_summary',
    'memory_retrieval',
    'planner_plan',
];
export const UNCACHEABLE_TOOLS = [
    'bash',
    'write',
    'edit',
    'apply_patch',
    'git_commit',
    'git_push',
];
export function isCacheableTool(toolName) {
    return CACHEABLE_TOOLS.includes(toolName);
}
export function isUncacheableTool(toolName) {
    return UNCACHEABLE_TOOLS.includes(toolName);
}
//# sourceMappingURL=cache-types.js.map