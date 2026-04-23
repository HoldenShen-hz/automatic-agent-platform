export class CitationBuilder {
    build(hit) {
        return `knowledge:${hit.chunkId}`;
    }
    buildMany(hits) {
        return Array.from(new Set(hits.map((hit) => this.build(hit))));
    }
}
//# sourceMappingURL=citation-builder.js.map