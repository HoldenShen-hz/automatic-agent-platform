function countOccurrences(content, keyword) {
    const normalizedContent = content.toLowerCase();
    const normalizedKeyword = keyword.toLowerCase();
    let count = 0;
    let start = 0;
    while (true) {
        const index = normalizedContent.indexOf(normalizedKeyword, start);
        if (index === -1) {
            return count;
        }
        count += 1;
        start = index + normalizedKeyword.length;
    }
}
export class KeywordKnowledgeIndex {
    chunks = new Map();
    inverted = new Map();
    upsert(chunk) {
        this.chunks.set(chunk.chunkId, chunk);
        for (const keyword of chunk.keywords) {
            const key = keyword.toLowerCase();
            const existing = this.inverted.get(key) ?? new Set();
            existing.add(chunk.chunkId);
            this.inverted.set(key, existing);
        }
    }
    query(keyword) {
        const ids = this.inverted.get(keyword.toLowerCase()) ?? new Set();
        return [...ids]
            .map((id) => this.chunks.get(id))
            .filter((chunk) => chunk != null)
            .map((chunk) => ({
            chunkId: chunk.chunkId,
            documentId: chunk.documentId,
            score: countOccurrences(chunk.content, keyword),
            matchType: "keyword",
            snippet: chunk.summary,
            knowledgeRef: `knowledge:${chunk.chunkId}`,
            namespace: chunk.namespace,
        }))
            .sort((left, right) => right.score - left.score);
    }
    reset() {
        this.chunks.clear();
        this.inverted.clear();
    }
}
//# sourceMappingURL=keyword-index.js.map