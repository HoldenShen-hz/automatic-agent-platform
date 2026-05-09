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

export class KnowledgeArchive {
  private readonly documentsByChecksum = new Map<string, ArchivedKnowledgeRecord>();
  private readonly recordsByDocumentId = new Map<string, ArchivedKnowledgeRecord>();
  private readonly recordsByChunkId = new Map<string, ArchivedKnowledgeChunkRecord>();

  public upsert(record: ArchivedKnowledgeRecord): ArchivedKnowledgeRecord {
    const existing = this.documentsByChecksum.get(record.source.checksum);
    if (existing) {
      // Remove old chunk records to prevent stale entries
      for (const oldChunk of existing.chunks) {
        this.recordsByChunkId.delete(oldChunk.chunkId);
      }
      const updated: ArchivedKnowledgeRecord = {
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

  public getDocument(documentId: string): ArchivedKnowledgeRecord | null {
    return this.recordsByDocumentId.get(documentId) ?? null;
  }

  public list(namespace?: string): ArchivedKnowledgeRecord[] {
    return [...this.recordsByDocumentId.values()].filter((record) => namespace == null || record.document.namespace === namespace);
  }

  public getChunk(chunkId: string): ArchivedKnowledgeChunkRecord | null {
    return this.recordsByChunkId.get(chunkId) ?? null;
  }

  public exportRecords(): ArchivedKnowledgeRecord[] {
    return this.list();
  }

  public replace(records: readonly ArchivedKnowledgeRecord[]): void {
    this.documentsByChecksum.clear();
    this.recordsByDocumentId.clear();
    this.recordsByChunkId.clear();
    for (const record of records) {
      this.upsert(record);
    }
  }
}
