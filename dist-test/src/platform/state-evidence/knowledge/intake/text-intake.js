import { KnowledgeIngestionPipeline } from "../knowledge-ingestion-pipeline.js";
export class TextKnowledgeIntake {
    pipeline;
    constructor(pipeline = new KnowledgeIngestionPipeline()) {
        this.pipeline = pipeline;
    }
    ingest(input) {
        return this.pipeline.ingest({
            ...input,
            sourceType: input.sourceType ?? "text",
        });
    }
}
//# sourceMappingURL=text-intake.js.map