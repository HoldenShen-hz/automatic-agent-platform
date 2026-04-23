import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { newId, nowIso } from "../../contracts/types/ids.js";
export class ArtifactPublishLedger {
    ledgerPath;
    entries = [];
    constructor(options = {}) {
        this.ledgerPath = options.ledgerPath ?? null;
    }
    record(bundle, metadata = {}) {
        const entry = {
            publishId: newId("artifact_publish"),
            bundleId: bundle.bundleId,
            taskId: bundle.taskId,
            domainId: bundle.domainId,
            bundleType: bundle.bundleType,
            artifactCount: bundle.artifacts.length,
            totalSize: bundle.totalSize,
            publishedAt: bundle.publishedAt ?? nowIso(),
            publishStatus: bundle.publishStatus,
            target: metadata.target ?? null,
            destination: metadata.destination ?? null,
        };
        this.entries.push(entry);
        if (this.ledgerPath) {
            mkdirSync(dirname(this.ledgerPath), { recursive: true });
            appendFileSync(this.ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
        }
        return entry;
    }
    list() {
        if (!this.ledgerPath || !existsSync(this.ledgerPath)) {
            return [...this.entries];
        }
        const content = readFileSync(this.ledgerPath, "utf8");
        return content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .map((line) => JSON.parse(line));
    }
}
//# sourceMappingURL=artifact-publish-ledger.js.map