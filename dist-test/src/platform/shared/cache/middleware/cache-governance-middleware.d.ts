/**
 * Cache Governance Middleware
 *
 * Middleware hook for cache-aware tool execution and prompt building.
 * Integrates with the agent middleware chain to provide cache
 * hit/miss tracking and automatic cache population.
 */
import type { CacheFacade } from '../cache-facade.js';
import type { StructuredLogger } from '../../observability/structured-logger.js';
import type { AfterAgentHook, WrapToolCallHook } from '../../../execution/execution-engine/agent-middleware-chain.js';
export interface CacheGovernanceMiddlewareOptions {
    cache: CacheFacade;
    logger?: StructuredLogger;
    workspaceRoot?: string;
}
/**
 * Creates the cache governance middleware for integration with the agent
 * middleware chain.
 */
export declare function createCacheGovernanceMiddleware(options: CacheGovernanceMiddlewareOptions): WrapToolCallHook;
export declare function createCacheSummaryMiddleware(options: CacheGovernanceMiddlewareOptions): AfterAgentHook;
/**
 * Invalidation helper for tool results.
 */
export declare function invalidateToolCache(cache: CacheFacade, toolName: string, args: Record<string, unknown>, workspaceRoot?: string): Promise<number>;
