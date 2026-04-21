import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { nowIso } from "../../../contracts/types/ids.js";
export class KnowledgeSnapshotStore {
    snapshotPath;
    constructor(options) {
        this.snapshotPath = options.snapshotPath;
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