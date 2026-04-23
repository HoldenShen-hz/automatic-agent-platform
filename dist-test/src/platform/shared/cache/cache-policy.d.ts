/**
 * Cache Policy Definitions
 *
 * Default policies for each cache namespace including TTL, scope,
 * max payload size, and version settings.
 */
import type { CachePolicy } from './cache-types.js';
export declare const DEFAULT_CACHE_POLICIES: Record<string, CachePolicy>;
export declare function getPolicyForNamespace(namespace: string, override?: Partial<CachePolicy>): CachePolicy;
export declare function isCacheableNamespace(namespace: string): boolean;
export declare function getTTLForNamespace(namespace: string): number;
export declare function getScopeForNamespace(namespace: string): string;
