export class KnowledgeArchive {
    documentsByChecksum = new Map();
    recordsByDocumentId = new Map();
    recordsByChunkId = new Map();
    upsert(record) {
        const existing = this.documentsByChecksum.get(record.source.checksum);
        if (existing) {
            const updated = {
                ...existing,
                document: {
                    ...existing.document,
                    version: existing.document.version + 1,
                    status: "indexed",
                    rawText: record.document.rawText,
                    archived: false,
                    archivedAt: null,
                },
                chunks: record.chunks,
            };
            this.documentsByChecksum.set(record.source.checksum, updated);
            this.recordsByDocumentId.set(updated.document.documentId, updated);
            for (const chunk of updated.chunks) {
                this.recordsByChunkId.set(chunk.chunkId, { record: updated, chunk });
            }
            return updated;
        }
        this.documentsByChecksum.set(record.source.checksum, record);
        this.recordsByDocumentId.set(record.document.documentId, record);
        for (const chunk of record.chunks) {
            this.recordsByChunkId.set(chunk.chunkId, { record, chunk });
        }
        return record;
    }
    getDocument(documentId) {
        return this.recordsByDocumentId.get(documentId) ?? null;
    }
    list(namespace) {
        return [...this.recordsByDocumentId.values()].filter((record) => namespace == null || record.document.namespace === namespace);
    }
    getChunk(chunkId) {
        return this.recordsByChunkId.get(chunkId) ?? null;
    }
    exportRecords() {
        return this.list();
    }
    replace(records) {
        this.documentsByChecksum.clear();
        this.recordsByDocumentId.clear();
        this.recordsByChunkId.clear();
        for (const record of records) {
            this.upsert(record);
        }
    }
}
//# sourceMappingURL=knowledge-archive.js.map