import { basename } from "node:path";

import type { ChunkingConfig, KnowledgeSource, TrustLevel } from "../knowledge-model.js";
import { KnowledgeIngestionPipeline, type KnowledgeIngestionResult } from "../knowledge-ingestion-pipeline.js";

export class FileKnowledgeIntake {
  public constructor(private readonly pipeline: KnowledgeIngestionPipeline = new KnowledgeIngestionPipeline()) {}

  public ingest(input: {
    path: string;
    content: string;
    namespace: string;
    trustLevel?: TrustLevel;
    tags?: readonly string[];
    sourceType?: KnowledgeSource["type"];
    chunking?: ChunkingConfig;
  }): KnowledgeIngestionResult {
    return this.pipeline.ingest({
      title: basename(input.path),
      body: input.content,
      namespace: input.namespace,
      sourceType: input.sourceType ?? "file",
      uri: input.path,
      ...(input.trustLevel != null ? { trustLevel: input.trustLevel } : {}),
      ...(input.tags != null ? { tags: input.tags } : {}),
      ...(input.chunking != null ? { chunking: input.chunking } : {}),
    });
  }
}
