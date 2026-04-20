import type { RetrievalHit } from "../knowledge-model.js";

export class CitationBuilder {
  public build(hit: RetrievalHit): string {
    return `knowledge:${hit.chunkId}`;
  }

  public buildMany(hits: readonly RetrievalHit[]): string[] {
    return Array.from(new Set(hits.map((hit) => this.build(hit))));
  }
}
