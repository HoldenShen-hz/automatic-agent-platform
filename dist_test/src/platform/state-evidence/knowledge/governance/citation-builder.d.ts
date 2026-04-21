import type { RetrievalHit } from "../knowledge-model.js";
export declare class CitationBuilder {
    build(hit: RetrievalHit): string;
    buildMany(hits: readonly RetrievalHit[]): string[];
}
