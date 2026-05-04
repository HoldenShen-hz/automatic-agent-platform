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

/**
 * Version history entry for knowledge document rollback support.
 * R25-5 Fix: Provides version history and rollback capability for knowledge archive.
 * Tracks all versions of a document enabling rollback to any previous version.
 */
export interface KnowledgeVersionEntry {
  version: number;
  record: ArchivedKnowledgeRecord;
  archivedAt: string;
  reason: string;
}

/**
 * KnowledgeArchive with version history and rollback support.
 * R25-5 Fix: Extends basic archive with full version tracking.
 */
export class KnowledgeArchive {
  private readonly documentsByChecksum = new Map<string, ArchivedKnowledgeRecord>();
  private readonly recordsByDocumentId = new Map<string, ArchivedKnowledgeRecord>();
  private readonly recordsByChunkId = new Map<string, ArchivedKnowledgeChunkRecord>();
  // R25-5 Fix: Add version history for rollback support
  private readonly versionHistoryByDocumentId = new Map<string, KnowledgeVersionEntry[]>();

  public upsert(record: ArchivedKnowledgeRecord): ArchivedKnowledgeRecord {
    const existing = this.documentsByChecksum.get(record.source.checksum);
    if (existing) {
      // R25-5 Fix: Save current version to history before overwriting
      const currentVersion = existing.document.version;
      this.addVersionHistory(existing.document.documentId, existing, currentVersion + 1, "update");

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
    // R25-5 Fix: Record initial version
    this.addVersionHistory(record.document.documentId, record, 1, "create");
    this.documentsByChecksum.set(record.source.checksum, record);
    this.recordsByDocumentId.set(record.document.documentId, record);
    for (const chunk of record.chunks) {
      this.recordsByChunkId.set(chunk.chunkId, { record, chunk });
    }
    return record;
  }

  /**
   * R25-5 Fix: Add version history entry for a document.
   */
  private addVersionHistory(documentId: string, record: ArchivedKnowledgeRecord, version: number, reason: string): void {
    const history = this.versionHistoryByDocumentId.get(documentId) ?? [];
    history.push({
      version,
      record,
      archivedAt: new Date().toISOString(),
      reason,
    });
    // Keep last 100 versions per document for bounded storage
    if (history.length > 100) {
      history.shift();
    }
    this.versionHistoryByDocumentId.set(documentId, history);
  }

  /**
   * R25-5 Fix: Get version history for a document.
   * @returns All versions in descending order (newest first)
   */
  public getVersionHistory(documentId: string): KnowledgeVersionEntry[] {
    const history = this.versionHistoryByDocumentId.get(documentId) ?? [];
    return [...history].reverse(); // Newest first
  }

  /**
   * R25-5 Fix: Rollback to a specific version.
   * @param documentId - Document to rollback
   * @param targetVersion - Version to rollback to
   * @returns The record at the target version, or null if version doesn't exist
   */
  public rollbackToVersion(documentId: string, targetVersion: number): ArchivedKnowledgeRecord | null {
    const history = this.versionHistoryByDocumentId.get(documentId) ?? [];
    const entry = history.find((h) => h.version === targetVersion);
    if (!entry) {
      return null;
    }
    const current = this.recordsByDocumentId.get(documentId);
    if (current) {
      // Save current version before rollback
      this.addVersionHistory(documentId, current, current.document.version + 1, `rollback_to_v${targetVersion}`);
    }
    // Restore the target version
    this.documentsByChecksum.set(entry.record.source.checksum, entry.record);
    this.recordsByDocumentId.set(documentId, entry.record);
    for (const chunk of entry.record.chunks) {
      this.recordsByChunkId.set(chunk.chunkId, { record: entry.record, chunk });
    }
    return entry.record;
  }

  /**
   * R25-5 Fix: Get the latest version number for a document.
   */
  public getLatestVersion(documentId: string): number {
    const history = this.versionHistoryByDocumentId.get(documentId) ?? [];
    return history.length > 0 ? history[history.length - 1]!.version : 0;
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
