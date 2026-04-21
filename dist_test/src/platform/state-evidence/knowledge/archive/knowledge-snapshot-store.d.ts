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
export declare class KnowledgeSnapshotStore {
    private readonly snapshotPath;
    constructor(options: KnowledgeSnapshotStoreOptions);
    load(): KnowledgePlaneSnapshot | null;
    save(input: {
        namespaces: readonly KnowledgeNamespace[];
        records: readonly ArchivedKnowledgeRecord[];
    }): KnowledgePlaneSnapshot;
}
