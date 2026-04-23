/**
 * Cache Governance Middleware
 *
 * Middleware hook for cache-aware tool execution and prompt building.
 * Integrates with the agent middleware chain to provide cache
 * hit/miss tracking and automatic cache population.
 */
import { isCacheableTool } from '../cache-types.js';
import { tagBuilder } from '../utils/tag-builder.js';
import { normalizePath } from '../utils/normalize-path.js';
/**
 * Creates the cache governance middleware for integration with the agent
 * middleware chain.
 */
export function createCacheGovernanceMiddleware(options) {
    const { cache, logger, workspaceRoot } = options;
    const middleware = {
        name: 'cache-governance',
        priority: 40,
        /**
         * Hook called before a tool is executed.
         * Checks cache for read-only cacheable tools.
         */
        async run(ctx, input, next) {
            const toolName = input.toolName;
            const toolArgs = input.args;
            if (!isCacheableTool(toolName)) {
                return next();
            }
            const normalizedArgs = { ...toolArgs };
            // Normalize paths if workspace root is available
            if (workspaceRoot && typeof normalizedArgs.path === 'string') {
                normalizedArgs.path = normalizePath(normalizedArgs.path, workspaceRoot);
            }
            const tags = tagBuilder.toolContext(toolName, normalizedArgs, ctx.taskId);
            const namespace = `tool.${toolName}`;
            try {
                const result = await cache.getOrCompute(namespace, normalizedArgs, next, { tags });
                if (result.fromCache) {
                    logger?.debug('Cache hit for tool', { toolName, taskId: ctx.taskId });
                }
                else {
                    logger?.debug('Cache miss for tool', { toolName, taskId: ctx.taskId });
                }
                return result.value;
            }
            catch (error) {
                // Cache errors should not break tool execution
                logger?.warn('Cache error, falling through to tool execution', {
                    toolName,
                    error: error instanceof Error ? error.message : String(error),
                });
                return next();
            }
        },
    };
    return middleware;
}
export function createCacheSummaryMiddleware(options) {
    const { cache, logger } = options;
    return {
        name: "cache-summary",
        priority: 40,
        async run(ctx) {
            const stats = cache.getMetricsSnapshot?.();
            if (stats) {
                logger?.debug("Cache metrics summary", { stats, taskId: ctx.taskId });
            }
            return { success: true };
        },
    };
}
/**
 * Invalidation helper for tool results.
 */
export async function invalidateToolCache(cache, toolName, args, workspaceRoot) {
    const normalizedArgs = { ...args };
    if (workspaceRoot && typeof normalizedArgs.path === 'string') {
        normalizedArgs.path = normalizePath(normalizedArgs.path, workspaceRoot);
    }
    const tag = `file:${normalizedArgs.path}`;
    return cache.invalidateByTag(tag);
}
//# sourceMappingURL=cache-governance-middleware.js.map