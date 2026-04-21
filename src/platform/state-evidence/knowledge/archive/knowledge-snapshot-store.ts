import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { nowIso } from "../../../contracts/types/ids.js";
import { checkToolPathScope } from "../../../execution/tool-executor/tool-path-scope.js";
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
    const scopeCheck = checkToolPathScope(options.snapshotPath, null);
    if (!scopeCheck.allowed) {
      throw new Error(`knowledge_snapshot_store.path_scope_denied: ${scopeCheck.normalizedPath}`);
    }
    this.snapshotPath = options.snapshotPath;
  }

  public load(): KnowledgePlaneSnapshot | null {
    if (!existsSync(this.snapshotPath)) {
      return null;
    }
    return JSON.parse(readFileSync(this.snapshotPath, "utf8")) as KnowledgePlaneSnapshot;
  }

  public save(input: { namespaces: readonly KnowledgeNamespace[]; records: readonly ArchivedKnowledgeRecord[] }): KnowledgePlaneSnapshot {
    const snapshot: KnowledgePlaneSnapshot = {
      generatedAt: nowIso(),
      namespaces: [...input.namespaces],
      records: [...input.records],
    };
    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
    return snapshot;
  }
}
