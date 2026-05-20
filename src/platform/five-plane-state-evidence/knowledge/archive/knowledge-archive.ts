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
  private readonly historyByDocumentId = new Map<string, ArchivedKnowledgeRecord[]>();

  public upsert(record: ArchivedKnowledgeRecord): ArchivedKnowledgeRecord {
    // Check if this exact checksum already exists
    const existing = this.documentsByChecksum.get(record.source.checksum);
    if (existing) {
      return existing;
    }

    // New checksum for a potentially existing documentId - clean up old checksum entry
    const existingByDocId = this.recordsByDocumentId.get(record.document.documentId);
    if (existingByDocId && existingByDocId.source.checksum !== record.source.checksum) {
      this.appendHistory(existingByDocId.document.documentId, existingByDocId);
      this.documentsByChecksum.delete(existingByDocId.source.checksum);
      // Delete old chunk records to prevent stale entries
      for (const oldChunk of existingByDocId.chunks) {
        this.recordsByChunkId.delete(oldChunk.chunkId);
      }
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

  public listVersions(documentId: string): ArchivedKnowledgeRecord[] {
    const history = this.historyByDocumentId.get(documentId) ?? [];
    const current = this.recordsByDocumentId.get(documentId);
    return current == null ? [...history] : [...history, current];
  }

  public getDocumentVersion(documentId: string, version: number): ArchivedKnowledgeRecord | null {
    return this.listVersions(documentId).find((record) => record.document.version === version) ?? null;
  }

  public diffDocumentVersions(documentId: string, fromVersion: number, toVersion: number): {
    addedChunkIds: string[];
    removedChunkIds: string[];
    changed: boolean;
  } | null {
    const from = this.getDocumentVersion(documentId, fromVersion);
    const to = this.getDocumentVersion(documentId, toVersion);
    if (from == null || to == null) {
      return null;
    }
    const fromChunkIds = new Set(from.chunks.map((chunk) => chunk.chunkId));
    const toChunkIds = new Set(to.chunks.map((chunk) => chunk.chunkId));
    const addedChunkIds = [...toChunkIds].filter((chunkId) => !fromChunkIds.has(chunkId)).sort();
    const removedChunkIds = [...fromChunkIds].filter((chunkId) => !toChunkIds.has(chunkId)).sort();
    return {
      addedChunkIds,
      removedChunkIds,
      changed: addedChunkIds.length > 0 || removedChunkIds.length > 0 || from.document.version !== to.document.version,
    };
  }

  public rollbackDocument(documentId: string, version: number): ArchivedKnowledgeRecord | null {
    const target = this.getDocumentVersion(documentId, version);
    if (target == null) {
      return null;
    }
    return this.upsert({
      source: { ...target.source },
      document: { ...target.document },
      chunks: target.chunks.map((chunk) => ({ ...chunk })),
    });
  }

  public replace(records: readonly ArchivedKnowledgeRecord[]): void {
    this.documentsByChecksum.clear();
    this.recordsByDocumentId.clear();
    this.recordsByChunkId.clear();
    this.historyByDocumentId.clear();
    for (const record of records) {
      this.upsert(record);
    }
  }

  private appendHistory(documentId: string, record: ArchivedKnowledgeRecord): void {
    const history = this.historyByDocumentId.get(documentId) ?? [];
    const latestVersion = history[history.length - 1]?.document.version;
    if (latestVersion === record.document.version) {
      return;
    }
    history.push({
      source: { ...record.source },
      document: { ...record.document },
      chunks: record.chunks.map((chunk) => ({ ...chunk })),
    });
    this.historyByDocumentId.set(documentId, history);
  }
}
