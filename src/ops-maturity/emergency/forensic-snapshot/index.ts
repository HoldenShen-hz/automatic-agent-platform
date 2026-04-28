export interface ForensicSnapshot {
  readonly snapshotId: string;
  readonly scope: string;
  readonly collectedAt: string;
  readonly artifactIds: readonly string[];
  readonly runtimeState: Readonly<Record<string, unknown>>;
  readonly configurationRefs: readonly string[];
  readonly logRefs: readonly string[];
  readonly planeAcknowledgments: readonly PlaneForensicEvidence[];
}

export interface PlaneForensicEvidence {
  readonly plane: "P1" | "P2" | "P3" | "P4" | "P5";
  readonly localStopState: "ack" | "failed" | "timeout";
  readonly evidenceRef: string;
}

export interface ForensicSnapshotInput {
  readonly snapshotId: string;
  readonly scope: string;
  readonly collectedAt: string;
  readonly artifactIds: readonly string[];
  readonly runtimeState?: Readonly<Record<string, unknown>>;
  readonly configurationRefs?: readonly string[];
  readonly logRefs?: readonly string[];
  readonly planeAcknowledgments?: readonly PlaneForensicEvidence[];
}

export function buildForensicSnapshot(input: ForensicSnapshotInput): ForensicSnapshot {
  return {
    snapshotId: input.snapshotId,
    scope: input.scope,
    collectedAt: input.collectedAt,
    artifactIds: [...input.artifactIds],
    runtimeState: structuredClone(input.runtimeState ?? {}),
    configurationRefs: [...(input.configurationRefs ?? [])],
    logRefs: [...(input.logRefs ?? [])],
    planeAcknowledgments: [...(input.planeAcknowledgments ?? [])],
  };
}

export function summarizeForensicSnapshot(snapshot: ForensicSnapshot): string {
  const artifactCount = Array.isArray(snapshot.artifactIds) ? snapshot.artifactIds.length : 0;
  const configurationCount = Array.isArray(snapshot.configurationRefs) ? snapshot.configurationRefs.length : 0;
  const logCount = Array.isArray(snapshot.logRefs) ? snapshot.logRefs.length : 0;
  const planeCount = Array.isArray(snapshot.planeAcknowledgments) ? snapshot.planeAcknowledgments.length : 0;
  return [
    `scope=${snapshot.scope}`,
    `artifacts=${artifactCount}`,
    `configs=${configurationCount}`,
    `logs=${logCount}`,
    `planes=${planeCount}`,
  ].join(",");
}
