import type { ChunkingConfig, KnowledgeSource, TrustLevel } from "../knowledge-model.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "../knowledge-ingestion-pipeline.js";
export declare class TextKnowledgeIntake {
    private readonly pipeline;
    constructor(pipeline?: KnowledgeIngestionPipeline);
    ingest(input: {
        title: string;
        body: string;
        namespace: string;
        trustLevel?: TrustLevel;
        tags?: readonly string[];
        sourceType?: KnowledgeSource["type"];
        chunking?: ChunkingConfig;
    }): KnowledgeIngestionResult;
}
