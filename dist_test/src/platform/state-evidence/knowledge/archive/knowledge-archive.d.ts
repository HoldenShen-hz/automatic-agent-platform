import type { KnowledgeChunk, KnowledgeDocument, KnowledgeSource } from "../knowledge-model.js";
export interface ArchivedKnowledgeRecord {
    source: KnowledgeSource;
    document: KnowledgeDocument;
    chunks: KnowledgeChunk[];
}
export interface ArchivedKnowledgeChunkRecord {
    record: ArchivedKnowledgeRecord;
    chunk: KnowledgeChunk;
}
export declare class KnowledgeArchive {
    private readonly documentsByChecksum;
    private readonly recordsByDocumentId;
    private readonly recordsByChunkId;
    upsert(record: ArchivedKnowledgeRecord): ArchivedKnowledgeRecord;
    getDocument(documentId: string): ArchivedKnowledgeRecord | null;
    list(namespace?: string): ArchivedKnowledgeRecord[];
    getChunk(chunkId: string): ArchivedKnowledgeChunkRecord | null;
    exportRecords(): ArchivedKnowledgeRecord[];
    replace(records: readonly ArchivedKnowledgeRecord[]): void;
}
