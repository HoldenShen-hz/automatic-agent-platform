/**
 * Cache Governance Middleware
 *
 * Middleware hook for cache-aware tool execution and prompt building.
 * Integrates with the agent middleware chain to provide cache
 * hit/miss tracking and automatic cache population.
 */

import type { CacheFacade } from '../cache-facade.js';
import type { StructuredLogger } from '../../observability/structured-logger.js';
import type {
  AfterAgentHook,
  MiddlewareContext,
  WrapToolCallHook,
} from '../../../execution/execution-engine/agent-middleware-chain.js';
import { isCacheableTool } from '../cache-types.js';
import { tagBuilder } from '../utils/tag-builder.js';
import { normalizePath } from '../utils/normalize-path.js';

export interface CacheGovernanceMiddlewareOptions {
  cache: CacheFacade;
  logger?: StructuredLogger;
  workspaceRoot?: string;
}

/**
 * Creates the cache governance middleware for integration with the agent
 * middleware chain.
 */
export function createCacheGovernanceMiddleware(options: CacheGovernanceMiddlewareOptions) {
  const { cache, logger, workspaceRoot } = options;

  const middleware: WrapToolCallHook = {
    name: 'cache-governance',
    priority: 40,

    /**
     * Hook called before a tool is executed.
     * Checks cache for read-only cacheable tools.
     */
    async run<T>(
      ctx: MiddlewareContext,
      input: { toolName: string; args: Record<string, unknown> },
      next: () => Promise<T>
    ): Promise<T> {
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
        const result = await cache.getOrCompute<T>(
          namespace,
          normalizedArgs,
          next,
          { tags }
        );

        if (result.fromCache) {
          logger?.debug('Cache hit for tool', { toolName, taskId: ctx.taskId });
        } else {
          logger?.debug('Cache miss for tool', { toolName, taskId: ctx.taskId });
        }

        return result.value;
      } catch (error) {
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

export function createCacheSummaryMiddleware(options: CacheGovernanceMiddlewareOptions): AfterAgentHook {
  const { cache, logger } = options;
  return {
    name: "cache-summary",
    priority: 40,
    async run(ctx): Promise<{ success: true }> {
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
export async function invalidateToolCache(
  cache: CacheFacade,
  toolName: string,
  args: Record<string, unknown>,
  workspaceRoot?: string
): Promise<number> {
  const normalizedArgs = { ...args };
  if (workspaceRoot && typeof normalizedArgs.path === 'string') {
    normalizedArgs.path = normalizePath(normalizedArgs.path, workspaceRoot);
  }

  const tag = `file:${normalizedArgs.path}`;
  return cache.invalidateByTag(tag);
}
