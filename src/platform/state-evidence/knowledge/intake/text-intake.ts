import type { ChunkingConfig, KnowledgeSource, TrustLevel } from "../knowledge-model.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "../knowledge-ingestion-pipeline.js";

export class TextKnowledgeIntake {
  public constructor(private readonly pipeline: KnowledgeIngestionPipeline = new KnowledgeIngestionPipeline()) {}

  public ingest(input: {
    title: string;
    body: string;
    namespace: string;
    trustLevel?: TrustLevel;
    tags?: readonly string[];
    sourceType?: KnowledgeSource["type"];
    chunking?: ChunkingConfig;
  }): KnowledgeIngestionResult {
    return this.pipeline.ingest({
      ...input,
      sourceType: input.sourceType ?? "text",
    });
  }
}
