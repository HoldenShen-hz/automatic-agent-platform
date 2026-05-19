/**
 * Cache Orchestration Types
 *
 * Defines the core types for the multi-level cache system including L1/L2/L3
 * cache scopes, metadata structures, policies, and lookup results.
 */

export type CacheScope = 'memory' | 'session' | 'persistent';

export type CacheLayer = 'L1' | 'L2' | 'L3';

export type CacheMissReason =
  | 'not_found'
  | 'expired'
  | 'invalidated'
  | 'version_mismatch'
  | 'payload_too_large'
  | 'disabled'
  | 'not_cacheable';

export interface CacheMeta {
  scope: CacheScope;
  ttlMs?: number;
  tags: string[];
  version: string;
  createdAt: number;
  expiresAt?: number | undefined;
  lastAccessedAt: number;
  hitCount: number;
  sizeBytes: number;
  contentType?: string | undefined;
}

export interface CacheEntry<T = unknown> {
  namespace: string;
  key: string;
  value: T;
  meta: CacheMeta;
}

export interface CacheLookupResult<T> {
  hit: boolean;
  value: T | null;
  layer?: CacheLayer;
  reason?: CacheMissReason;
  meta?: CacheMeta;
  backfillFailed?: boolean;
}

export interface CachePolicy {
  enabled: boolean;
  scope: CacheScope;
  ttlMs: number;
  version: string;
  maxPayloadBytes: number;
  tags?: string[] | undefined;
  staleWhileRevalidate?: boolean | undefined;
}

export interface CacheComputeOptions {
  tags?: string[] | undefined;
  contentType?: string | undefined;
  forceBypass?: boolean | undefined;
}

export interface CacheRequest<TInput = unknown> {
  namespace: string;
  keyInput: TInput;
  sessionId?: string;
  policyOverride?: Partial<CachePolicy>;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  evictions: number;
}

export interface CacheStats {
  namespace: string;
  layer: CacheLayer;
  hitCount: number;
  missCount: number;
  hitRate: number;
  totalSizeBytes: number;
  entryCount: number;
}

export type CacheableTool =
  | 'read'
  | 'glob'
  | 'grep'
  | 'repo_map'
  | 'diagnostics'
  | 'web_fetch'
  | 'memory_summary'
  | 'memory_retrieval'
  | 'planner_plan';

export const CACHEABLE_TOOLS: readonly CacheableTool[] = [
  'read',
  'glob',
  'grep',
  'repo_map',
  'diagnostics',
  'web_fetch',
  'memory_summary',
  'memory_retrieval',
  'planner_plan',
] as const;

export const UNCACHEABLE_TOOLS = [
  'bash',
  'write',
  'edit',
  'apply_patch',
  'git_commit',
  'git_push',
] as const;

export function isCacheableTool(toolName: string): boolean {
  return (CACHEABLE_TOOLS as readonly string[]).includes(toolName);
}

export function isUncacheableTool(toolName: string): boolean {
  return (UNCACHEABLE_TOOLS as readonly string[]).includes(toolName);
}
