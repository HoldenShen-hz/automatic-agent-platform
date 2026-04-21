import type { ChunkingConfig, KnowledgeSource, TrustLevel } from "../knowledge-model.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "../knowledge-ingestion-pipeline.js";
export declare class FileKnowledgeIntake {
    private readonly pipeline;
    constructor(pipeline?: KnowledgeIngestionPipeline);
    ingest(input: {
        path: string;
        content: string;
        namespace: string;
        trustLevel?: TrustLevel;
        tags?: readonly string[];
        sourceType?: KnowledgeSource["type"];
        chunking?: ChunkingConfig;
    }): KnowledgeIngestionResult;
}
