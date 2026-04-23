import { basename } from "node:path";
import { KnowledgeIngestionPipeline } from "../knowledge-ingestion-pipeline.js";
export class FileKnowledgeIntake {
    pipeline;
    constructor(pipeline = new KnowledgeIngestionPipeline()) {
        this.pipeline = pipeline;
    }
    ingest(input) {
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
//# sourceMappingURL=file-intake.js.map