import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { nowIso } from "../../../contracts/types/ids.js";
import { checkToolPathScope } from "../../../execution/tool-executor/tool-path-scope.js";
export class KnowledgeSnapshotStore {
    snapshotPath;
    constructor(options) {
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
        if (isAbsolute(options.snapshotPath) && !normalizedPath.startsWith("/tmp/aa-sandbox/")) {
            throw new Error(`knowledge_snapshot_store.path_scope_denied: ${normalizedPath}`);
        }
        this.snapshotPath = normalizedPath;
    }
    load() {
        if (!existsSync(this.snapshotPath)) {
            return null;
        }
        return JSON.parse(readFileSync(this.snapshotPath, "utf8"));
    }
    save(input) {
        const snapshot = {
            generatedAt: nowIso(),
            namespaces: [...input.namespaces],
            records: [...input.records],
        };
        mkdirSync(dirname(this.snapshotPath), { recursive: true });
        writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
        return snapshot;
    }
}
//# sourceMappingURL=knowledge-snapshot-store.js.map