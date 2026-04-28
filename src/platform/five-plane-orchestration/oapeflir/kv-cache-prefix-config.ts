/**
 * KV Cache Fixed Prefix Configuration
 *
 * §E.7: System prompt 3-layer structure enabling KV cache key reuse.
 * Layer 1 (fixed) + Layer 2 (domain) produce a stable cache key, yielding
 * 20-40% prefill latency reduction on repeated prompts.
 *
 * Design: fixed (800-1200 tokens) + domain (300-500 per domain) + variable (per-agent)
 */

import { z } from "zod";

export const KvCacheLayerSchema = z.object({
  /** Static system instructions that never change */
  fixedPrefix: z.string(),
  /** Domain-specific instructions loaded per domain */
  domainBlock: z.string().optional(),
  /** Agent-specific variable suffix */
  variableSuffix: z.string().optional(),
});

export const KvCachePrefixConfigSchema = z.object({
  /** Cache key prefix for the fixed layer */
  cacheKeyPrefix: z.string().min(1),
  /** Token budget for fixed prefix */
  fixedPrefixTokens: z.number().int().positive().default(1024),
  /** Token budget for domain block */
  domainBlockTokens: z.number().int().positive().default(384),
  /** Token budget for variable suffix */
  variableSuffixTokens: z.number().int().positive().default(512),
  /** Whether KV cache is enabled */
  enabled: z.boolean().default(true),
  /** Domains that have domain block templates */
  domainBlocks: z.record(z.string(), z.string()).default({}),
});

export type KvCacheLayer = z.infer<typeof KvCacheLayerSchema>;
export type KvCachePrefixConfig = z.infer<typeof KvCachePrefixConfigSchema>;

/**
 * Build a KV cache key from fixed + domain layer hashes.
 * The variable suffix is NOT included because it changes per-agent-session.
 */
export function buildCacheKey(config: KvCachePrefixConfig, domainId: string): string {
  const domainBlock = config.domainBlocks[domainId] ?? "";
  const combined = `${config.cacheKeyPrefix}:${domainBlock}`;
  // Simple hash for cache key — provider layer handles actual KV reuse
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
  }
  return `kv_${Math.abs(hash).toString(16)}_${domainId}`;
}

/**
 * Token estimate for a string (rough: ~4 chars per token).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
