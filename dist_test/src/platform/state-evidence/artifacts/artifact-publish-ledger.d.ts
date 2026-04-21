import type { ArtifactBundleExtended } from "./artifact-model.js";
export interface ArtifactPublishLedgerEntry {
    publishId: string;
    bundleId: string;
    taskId: string;
    domainId: string;
    bundleType: ArtifactBundleExtended["bundleType"];
    artifactCount: number;
    totalSize: number;
    publishedAt: string;
    publishStatus: ArtifactBundleExtended["publishStatus"];
    target?: string | null;
    destination?: string | null;
}
export interface ArtifactPublishLedgerOptions {
    ledgerPath?: string;
}
export declare class ArtifactPublishLedger {
    private readonly ledgerPath;
    private readonly entries;
    constructor(options?: ArtifactPublishLedgerOptions);
    record(bundle: ArtifactBundleExtended, metadata?: {
        target?: string | null;
        destination?: string | null;
    }): ArtifactPublishLedgerEntry;
    list(): ArtifactPublishLedgerEntry[];
}
