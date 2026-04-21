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
export declare const KvCacheLayerSchema: z.ZodObject<{
    /** Static system instructions that never change */
    fixedPrefix: z.ZodString;
    /** Domain-specific instructions loaded per domain */
    domainBlock: z.ZodOptional<z.ZodString>;
    /** Agent-specific variable suffix */
    variableSuffix: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    fixedPrefix: string;
    domainBlock?: string | undefined;
    variableSuffix?: string | undefined;
}, {
    fixedPrefix: string;
    domainBlock?: string | undefined;
    variableSuffix?: string | undefined;
}>;
export declare const KvCachePrefixConfigSchema: z.ZodObject<{
    /** Cache key prefix for the fixed layer */
    cacheKeyPrefix: z.ZodString;
    /** Token budget for fixed prefix */
    fixedPrefixTokens: z.ZodDefault<z.ZodNumber>;
    /** Token budget for domain block */
    domainBlockTokens: z.ZodDefault<z.ZodNumber>;
    /** Token budget for variable suffix */
    variableSuffixTokens: z.ZodDefault<z.ZodNumber>;
    /** Whether KV cache is enabled */
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Domains that have domain block templates */
    domainBlocks: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    cacheKeyPrefix: string;
    fixedPrefixTokens: number;
    domainBlockTokens: number;
    variableSuffixTokens: number;
    domainBlocks: Record<string, string>;
}, {
    cacheKeyPrefix: string;
    enabled?: boolean | undefined;
    fixedPrefixTokens?: number | undefined;
    domainBlockTokens?: number | undefined;
    variableSuffixTokens?: number | undefined;
    domainBlocks?: Record<string, string> | undefined;
}>;
export type KvCacheLayer = z.infer<typeof KvCacheLayerSchema>;
export type KvCachePrefixConfig = z.infer<typeof KvCachePrefixConfigSchema>;
/**
 * Build a KV cache key from fixed + domain layer hashes.
 * The variable suffix is NOT included because it changes per-agent-session.
 */
export declare function buildCacheKey(config: KvCachePrefixConfig, domainId: string): string;
/**
 * Token estimate for a string (rough: ~4 chars per token).
 */
export declare function estimateTokens(text: string): number;
