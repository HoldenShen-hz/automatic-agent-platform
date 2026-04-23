export interface ForensicSnapshot {
    readonly snapshotId: string;
    readonly scope: string;
    readonly collectedAt: string;
    readonly artifactIds: readonly string[];
    readonly runtimeState: Readonly<Record<string, unknown>>;
    readonly configurationRefs: readonly string[];
    readonly logRefs: readonly string[];
}
export interface ForensicSnapshotInput {
    readonly snapshotId: string;
    readonly scope: string;
    readonly collectedAt: string;
    readonly artifactIds: readonly string[];
    readonly runtimeState?: Readonly<Record<string, unknown>>;
    readonly configurationRefs?: readonly string[];
    readonly logRefs?: readonly string[];
}
export declare function buildForensicSnapshot(input: ForensicSnapshotInput): ForensicSnapshot;
export declare function summarizeForensicSnapshot(snapshot: ForensicSnapshot): string;
