export interface ForensicSnapshot {
    readonly snapshotId: string;
    readonly scope: string;
    readonly collectedAt: string;
    readonly artifactIds: readonly string[];
}
export declare function buildForensicSnapshot(snapshotId: string, scope: string, collectedAt: string, artifactIds: readonly string[]): ForensicSnapshot;
