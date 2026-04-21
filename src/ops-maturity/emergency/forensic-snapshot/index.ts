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

export function buildForensicSnapshot(input: ForensicSnapshotInput): ForensicSnapshot {
  return {
    snapshotId: input.snapshotId,
    scope: input.scope,
    collectedAt: input.collectedAt,
    artifactIds: input.artifactIds,
    runtimeState: input.runtimeState ?? {},
    configurationRefs: input.configurationRefs ?? [],
    logRefs: input.logRefs ?? [],
  };
}

export function summarizeForensicSnapshot(snapshot: ForensicSnapshot): string {
  return [
    `scope=${snapshot.scope}`,
    `artifacts=${snapshot.artifactIds.length}`,
    `configs=${snapshot.configurationRefs.length}`,
    `logs=${snapshot.logRefs.length}`,
  ].join(",");
}
