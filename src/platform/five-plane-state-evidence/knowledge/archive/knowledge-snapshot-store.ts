import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute } from "node:path";

import { nowIso } from "../../../contracts/types/ids.js";
import { checkToolPathScope } from "../../../five-plane-execution/tool-gateway/index.js";
import type { KnowledgeNamespace } from "../knowledge-model.js";
import type { ArchivedKnowledgeRecord } from "./knowledge-archive.js";

export interface KnowledgePlaneSnapshot {
  generatedAt: string;
  namespaces: KnowledgeNamespace[];
  records: ArchivedKnowledgeRecord[];
}

export interface KnowledgeSnapshotStoreOptions {
  snapshotPath: string;
}

export class KnowledgeSnapshotStore {
  private readonly snapshotPath: string;

  public constructor(options: KnowledgeSnapshotStoreOptions) {
    if (options.snapshotPath.includes("\0")) {
      throw new Error("knowledge_snapshot_store.path_null_byte_denied");
    }
    if (options.snapshotPath.split(/[\\/]+/).includes("..")) {
      throw new Error(`knowledge_snapshot_store.path_traversal_denied: ${options.snapshotPath}`);
    }
    const scopeCheck = checkToolPathScope(options.snapshotPath, null);
    if (!scopeCheck.allowed) {
      throw new Error(`knowledge_snapshot_store.path_scope_denied: ${scopeCheck.normalizedPath}`);
    }
    // Additional validation: reject path traversal patterns even when no roots specified
    // This ensures security even when checkToolPathScope has no restrictions
    const normalizedPath = scopeCheck.normalizedPath;
    if (normalizedPath.includes("..")) {
      throw new Error(`knowledge_snapshot_store.path_traversal_denied: ${normalizedPath}`);
    }
    // When no roots are specified, only allow relative paths or paths within /tmp/aa-sandbox/
    // This prevents access to system paths like /etc/shadow
    const tempRoot = tmpdir().endsWith("/") ? tmpdir() : `${tmpdir()}/`;
    if (
      isAbsolute(options.snapshotPath) &&
      !normalizedPath.startsWith("/tmp/aa-sandbox/") &&
      !normalizedPath.startsWith(tempRoot)
    ) {
      throw new Error(`knowledge_snapshot_store.path_scope_denied: ${normalizedPath}`);
    }
    this.snapshotPath = normalizedPath;
  }

  public load(): KnowledgePlaneSnapshot | null {
    if (!existsSync(this.snapshotPath)) {
      return null;
    }
    if (!statSync(this.snapshotPath).isFile()) {
      return null;
    }
    // R30-13 fix: Validate JSON structure before returning to prevent corrupted/tampered data
    // from silently propagating invalid state through the system
    const rawContent = readFileSync(this.snapshotPath, "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Corrupted JSON - return null rather than invalid data
      return null;
    }
    if (!isKnowledgePlaneSnapshot(parsed)) {
      return null;
    }
    return parsed as KnowledgePlaneSnapshot;
  }

  public save(input: { namespaces: readonly KnowledgeNamespace[]; records: readonly ArchivedKnowledgeRecord[] }): KnowledgePlaneSnapshot {
    const snapshot: KnowledgePlaneSnapshot = {
      generatedAt: nowIso(),
      namespaces: [...input.namespaces],
      records: [...input.records],
    };
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    const tmpPath = `${this.snapshotPath}.${process.pid}.${Date.now()}.tmp`;
    try {
      writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
      renameSync(tmpPath, this.snapshotPath);
    } catch (error) {
      try {
        if (existsSync(tmpPath)) {
          unlinkSync(tmpPath);
        }
      } catch {
        // Best effort cleanup only; preserve original write error.
      }
      throw error;
    }
    return snapshot;
  }
}

function isKnowledgePlaneSnapshot(value: unknown): value is KnowledgePlaneSnapshot {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.generatedAt === "string"
    && Array.isArray(candidate.namespaces)
    && candidate.namespaces.every((namespace) => namespace != null && typeof namespace === "object" && !Array.isArray(namespace))
    && Array.isArray(candidate.records)
    && candidate.records.every(isArchivedKnowledgeRecordLike);
}

function isArchivedKnowledgeRecordLike(value: unknown): boolean {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  const source = candidate.source;
  const document = candidate.document;
  return source != null
    && typeof source === "object"
    && !Array.isArray(source)
    && document != null
    && typeof document === "object"
    && !Array.isArray(document)
    && Array.isArray(candidate.chunks)
    && candidate.chunks.every((chunk) => chunk != null && typeof chunk === "object" && !Array.isArray(chunk));
}
