import type { KnowledgeChunk, RetrievalHit } from "./knowledge-model.js";
export declare class KeywordKnowledgeIndex {
    private readonly chunks;
    private readonly inverted;
    upsert(chunk: KnowledgeChunk): void;
    query(keyword: string): RetrievalHit[];
    reset(): void;
}
