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
} from '../../../five-plane-execution/execution-engine/agent-middleware-chain.js';
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
      let toolResult: T | undefined;
      let toolState: "not_started" | "resolved" | "rejected" = "not_started";

      try {
        const result = await cache.getOrCompute<T>(
          namespace,
          normalizedArgs,
          async () => {
            try {
              const value = await next();
              toolState = "resolved";
              toolResult = value;
              return value;
            } catch (error) {
              toolState = "rejected";
              throw error;
            }
          },
          { tags }
        );

        if (result.fromCache) {
          logger?.debug('Cache hit for tool', { toolName, taskId: ctx.taskId });
        } else {
          logger?.debug('Cache miss for tool', { toolName, taskId: ctx.taskId });
        }

        return result.value;
      } catch (error) {
        if (toolState === "resolved") {
          logger?.warn("Cache write failed after tool execution; returning uncached result", {
            toolName,
            error: error instanceof Error ? error.message : String(error),
          });
          return toolResult as T;
        }
        if (toolState === "rejected") {
          throw error;
        }
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
    async run(ctx): Promise<{ success: boolean; error?: { code: string; message: string; warning?: boolean } }> {
      let stats: unknown;
      try {
        stats = cache.getMetricsSnapshot?.();
      } catch (error) {
        logger?.warn("Cache metrics summary unavailable", {
          error: error instanceof Error ? error.message : String(error),
          taskId: ctx.taskId,
        });
        return {
          success: false,
          error: {
            code: "cache.metrics_snapshot_failed",
            message: error instanceof Error ? error.message : String(error),
            warning: true,
          },
        };
      }
      if (stats) {
        logger?.debug("Cache metrics summary", { stats, taskId: ctx.taskId });
        return { success: true };
      }
      return {
        success: false,
        error: {
          code: "cache.metrics_snapshot_unavailable",
          message: "Cache metrics snapshot is unavailable.",
          warning: true,
        },
      };
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
