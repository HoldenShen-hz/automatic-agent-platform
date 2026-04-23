export function buildForensicSnapshot(input) {
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
export function summarizeForensicSnapshot(snapshot) {
    return [
        `scope=${snapshot.scope}`,
        `artifacts=${snapshot.artifactIds.length}`,
        `configs=${snapshot.configurationRefs.length}`,
        `logs=${snapshot.logRefs.length}`,
    ].join(",");
}
//# sourceMappingURL=index.js.map