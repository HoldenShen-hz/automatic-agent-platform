/**
 * @fileoverview Embedding Provider — abstraction for text vectorization.
 *
 * Supports pluggable backends:
 * - `"hash"`: Fast deterministic hash-based pseudo-vectors (no external dependency)
 * - `"openai"`: OpenAI `/v1/embeddings` API (text-embedding-3-small, 1536 dims)
 * - `"minimax"`: MiniMax Embedding API (e.g., embo-01, 1024 dims)
 *
 * The 32-dimensional hash embedding is kept as the default fallback so the
 * knowledge pipeline works without any external API key.
 *
 * Part of GAP-V2-02: replace SHA-256 pseudo-vectors with real neural embeddings.
 */
export declare const EMBEDDING_PROVIDER_TYPES: readonly ["hash", "openai", "minimax"];
export type EmbeddingProviderType = (typeof EMBEDDING_PROVIDER_TYPES)[number];
export interface EmbeddingResult {
    /** 32-dim (hash) or provider-native-dim vector, normalised to [0,1] */
    vector: readonly number[];
    /** Provider-native dimension count (useful for pgvector schema validation) */
    dimensions: number;
    /** Token count used for the embedding call (where applicable) */
    tokenCount?: number;
}
/** Create from environment variables only — no managed options needed. */
export type EmbeddingProviderFactory = (env?: NodeJS.ProcessEnv) => EmbeddingProvider;
export interface EmbeddingProvider {
    readonly type: EmbeddingProviderType;
    readonly dimensions: number;
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
/** -------------------------------------------------------------------------- */
/** Hash (fallback) provider — mirrors the existing SHA-256 logic exactly        */
/** -------------------------------------------------------------------------- */
export declare class HashEmbeddingProvider implements EmbeddingProvider {
    readonly type: "hash";
    readonly dimensions = 32;
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
/** -------------------------------------------------------------------------- */
/** OpenAI embeddings API                                                    */
/** -------------------------------------------------------------------------- */
export interface OpenAIEmbeddingOptions {
    apiKey: string;
    baseUrl?: string;
    model?: string;
    dimensions?: number;
    batchSize?: number;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    #private;
    readonly type: "openai";
    constructor(options: OpenAIEmbeddingOptions);
    get dimensions(): number;
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
/** -------------------------------------------------------------------------- */
/** Factory                                                                  */
/** -------------------------------------------------------------------------- */
export declare function createEmbeddingProviderFromEnv(env?: NodeJS.ProcessEnv): EmbeddingProvider;
/** -------------------------------------------------------------------------- */
/** MiniMax embeddings API                                                    */
/** -------------------------------------------------------------------------- */
export interface MiniMaxEmbeddingOptions {
    apiKey: string;
    baseUrl?: string;
    groupId?: string;
    model?: string;
}
export declare class MiniMaxEmbeddingProvider implements EmbeddingProvider {
    #private;
    readonly type: "minimax";
    readonly dimensions = 1024;
    constructor(options: MiniMaxEmbeddingOptions);
    embed(text: string): Promise<EmbeddingResult>;
    embedBatch(texts: string[]): Promise<EmbeddingResult[]>;
}
