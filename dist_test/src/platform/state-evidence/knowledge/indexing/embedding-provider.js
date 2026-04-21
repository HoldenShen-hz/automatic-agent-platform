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
import { buildSemanticEmbedding } from "../semantic-embedding.js";
export const EMBEDDING_PROVIDER_TYPES = ["hash", "openai", "minimax"];
/** -------------------------------------------------------------------------- */
/** Hash (fallback) provider — mirrors the existing SHA-256 logic exactly        */
/** -------------------------------------------------------------------------- */
export class HashEmbeddingProvider {
    type = "hash";
    dimensions = 32;
    async embed(text) {
        const vector = buildSemanticEmbedding(text);
        if (!vector) {
            throw new Error("embedding.hash.empty_input: cannot build embedding for empty text");
        }
        return { vector, dimensions: this.dimensions };
    }
    async embedBatch(texts) {
        return Promise.all(texts.map((t) => this.embed(t)));
    }
}
export class OpenAIEmbeddingProvider {
    type = "openai";
    #apiKey;
    #baseUrl;
    #model;
    #dimensions;
    #batchSize;
    constructor(options) {
        this.#apiKey = options.apiKey;
        this.#baseUrl = (options.baseUrl ?? "https://api.openai.com").replace(/\/$/, "");
        this.#model = options.model ?? "text-embedding-3-small";
        this.#dimensions = options.dimensions ?? 1536;
        this.#batchSize = options.batchSize ?? 100;
    }
    get dimensions() {
        return this.#dimensions;
    }
    async embed(text) {
        const results = await this.#fetch([text]);
        return results[0];
    }
    async embedBatch(texts) {
        const results = [];
        for (let i = 0; i < texts.length; i += this.#batchSize) {
            const batch = texts.slice(i, i + this.#batchSize);
            results.push(...(await this.#fetch(batch)));
        }
        return results;
    }
    async #fetch(texts) {
        const response = await fetch(`${this.#baseUrl}/v1/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.#apiKey}`,
            },
            body: JSON.stringify({
                input: texts,
                model: this.#model,
                dimensions: this.#dimensions,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`embedding.openai.request_failed:${response.status}:${body}`);
        }
        const json = (await response.json());
        return json.data
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((item) => ({
            vector: item.embedding,
            dimensions: item.embedding.length,
            tokenCount: json.usage.total_tokens,
        }));
    }
}
/** -------------------------------------------------------------------------- */
/** Factory                                                                  */
/** -------------------------------------------------------------------------- */
export function createEmbeddingProviderFromEnv(env = process.env) {
    const type = env.AA_KNOWLEDGE_EMBEDDING_PROVIDER?.trim() ?? "hash";
    switch (type) {
        case "openai": {
            const apiKey = env.OPENAI_API_KEY ?? env.AA_OPENAI_API_KEY ?? "";
            if (!apiKey) {
                throw new Error("embedding.openai.missing_api_key: set OPENAI_API_KEY or AA_OPENAI_API_KEY");
            }
            const opts = {
                apiKey,
                ...(env.OPENAI_API_BASE_URL && { baseUrl: env.OPENAI_API_BASE_URL }),
                ...(env.AA_OPENAI_EMBEDDING_MODEL && { model: env.AA_OPENAI_EMBEDDING_MODEL }),
                ...(env.AA_OPENAI_EMBEDDING_DIMENSIONS && { dimensions: Number(env.AA_OPENAI_EMBEDDING_DIMENSIONS) }),
                ...(env.AA_OPENAI_EMBEDDING_BATCH_SIZE && { batchSize: Number(env.AA_OPENAI_EMBEDDING_BATCH_SIZE) }),
            };
            return new OpenAIEmbeddingProvider(opts);
        }
        case "minimax": {
            const apiKey = env.MINIMAX_API_KEY ?? env.AA_MINIMAX_API_KEY ?? "";
            if (!apiKey) {
                throw new Error("embedding.minimax.missing_api_key: set MINIMAX_API_KEY or AA_MINIMAX_API_KEY");
            }
            // MiniMax embedding endpoint - use token from env or configurable
            return new MiniMaxEmbeddingProvider({
                apiKey,
                baseUrl: env.MINIMAX_API_BASE ?? "https://api.minimaxi.com/v1",
                groupId: env.MINIMAX_GROUP_ID ?? "",
                model: env.AA_MINIMAX_EMBEDDING_MODEL ?? "embo-01",
            });
        }
        case "hash":
        default:
            return new HashEmbeddingProvider();
    }
}
export class MiniMaxEmbeddingProvider {
    type = "minimax";
    #apiKey;
    #baseUrl;
    #groupId;
    #model;
    // MiniMax embo-01 returns 1024-dim vectors
    dimensions = 1024;
    constructor(options) {
        this.#apiKey = options.apiKey;
        const normalized = (options.baseUrl ?? "https://api.minimaxi.com/v1").replace(/\/$/, "");
        this.#baseUrl = normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
        this.#groupId = options.groupId ?? "";
        this.#model = options.model ?? "embo-01";
    }
    async embed(text) {
        const results = await this.#fetch([text]);
        return results[0];
    }
    async embedBatch(texts) {
        return this.#fetch(texts);
    }
    async #fetch(texts) {
        const response = await fetch(`${this.#baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.#apiKey}`,
            },
            body: JSON.stringify({
                input: texts,
                model: this.#model,
                group_id: this.#groupId,
            }),
        });
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            throw new Error(`embedding.minimax.request_failed:${response.status}:${body}`);
        }
        const json = (await response.json());
        return json.data
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((item) => ({
            vector: item.embedding,
            dimensions: item.embedding.length,
        }));
    }
}
//# sourceMappingURL=embedding-provider.js.map